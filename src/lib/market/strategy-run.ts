import {
  confirmedSignals,
  settleTrade,
  boardOf,
  type ExitMode,
} from "@/lib/pattern/adam-eve";
import {
  blockedName,
  describeRegime,
  entryGate,
  netReturn,
  type GateCode,
  type RegimeSnapshot,
} from "@/lib/market/gates";
import {
  cleanName,
  loadBars,
  loadLongBars,
  loadLongSymbol,
  loadSymbol,
  loadUniverse,
  mapPool,
} from "@/lib/market/quotes";
import {
  simulateBook,
  type BookTrade,
  type StrategyStats,
} from "@/lib/market/strategy";

export type StrategyReport = StrategyStats & {
  from: string;
  to: string;
  signalFrom: string;
  universeSize: number;
  scanned: number;
  failed: number;
  signals: number;
  rejected: Record<GateCode, number>;
  riskOffDays: number;
  regime: RegimeSnapshot;
  version: "v2";
  generatedAt: string;
  exitMode: ExitMode;
  comparison: StrategyStats;
  warnings: string[];
};

const UNIVERSE = 200;
const HISTORY = 640;
const LONG_START = "2006-09-23";

export type Span = "2y" | "20y";

const cache = new Map<string, { at: number; report: StrategyReport }>();
const TTL = 30 * 60 * 1000;

async function liquidNames(limit: number) {
  const pageSize = 100;
  const pages = Math.ceil(limit / pageSize);
  const rows = [];
  for (let page = 1; page <= pages; page += 1) {
    const batch = await loadUniverse("hs_a", pageSize, page);
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  const seen = new Set<string>();
  const unique = [];
  for (const row of rows) {
    if (!row.code || seen.has(row.code)) continue;
    const name = cleanName(String(row.name || ""));
    if (blockedName(name)) continue;
    if (boardOf(row.code) === "other") continue;
    seen.add(row.code);
    unique.push({ code: row.code, name });
    if (unique.length >= limit) break;
  }
  return unique;
}

export async function runStrategyBacktest(
  force = false,
  limit = UNIVERSE,
  book: "adam-eve" | "eve-adam" = "adam-eve",
  span: Span = "2y",
): Promise<StrategyReport> {
  const universe = limit || UNIVERSE;
  const long = book === "eve-adam" && span === "20y";
  const key = `${book}:${universe}:${long ? "20y" : "2y"}`;
  const cached = cache.get(key);
  if (!force && cached && Date.now() - cached.at < TTL) return cached.report;

  const [names, shanghai, csi] = await Promise.all([
    liquidNames(universe),
    long
      ? loadLongSymbol("sh000001", LONG_START)
      : loadSymbol("sh000001", HISTORY),
    long
      ? loadLongSymbol("sh000300", LONG_START)
      : loadSymbol("sh000300", HISTORY),
  ]);
  if (!names.length) throw new Error("股票池为空，不能生成回测收益");
  if (shanghai.length < 80 || shanghai.at(-1)?.date !== csi.at(-1)?.date)
    throw new Error("指数数据不完整或日期不一致");
  if (csi.length < 80) throw new Error("沪深300日线不足，回测停住了");
  const regime = describeRegime(shanghai, csi);
  const calendar = csi.map((bar) => bar.date);
  const nextSession = new Map(
    calendar.slice(0, -1).map((day, i) => [day, calendar[i + 1]]),
  );
  const failures: string[] = [];
  const rejected: Record<GateCode, number> = {
    name: 0,
    ipo: 0,
    halt: 0,
    limit: 0,
    amount: 0,
  };
  let failed = 0;
  let finished = 0;

  const books = await mapPool(names, long ? 4 : 8, async (row) => {
    try {
      const loaded = long
        ? await loadLongBars(row.code, LONG_START, force)
        : await loadBars(row.code, HISTORY, force);
      const name = cleanName(loaded.name || row.name);
      if (blockedName(name)) {
        rejected.name += 1;
        return { trend: [] as BookTrade[], fixed: [] as BookTrade[] };
      }
      const first = loaded.bars[0]?.date ?? "9999-99-99";
      const young = long ? first > "2007-01-01" : loaded.bars.length < 500;
      const signals = confirmedSignals(loaded.bars, book);
      const convert = (mode: ExitMode) => {
        const history = signals.map((pattern) =>
          settleTrade(loaded.bars, pattern, mode, row.code),
        );
        const trades: BookTrade[] = [];
        for (const trade of history) {
          const index = trade.pattern.signalIndex;
          if (index == null || trade.outcome === "missed" || !trade.entryDate)
            continue;
          if (nextSession.get(trade.signalDate) !== trade.entryDate) continue;
          const reason = entryGate(row.code, loaded.bars, index, young);
          if (reason) {
            if (mode === "trend") rejected[reason] += 1;
            continue;
          }
          trades.push({
            code: row.code,
            signalDate: trade.signalDate,
            entryDate: trade.entryDate,
            exitDate: trade.exitDate,
            score: trade.pattern.score,
            gross: trade.returnPct,
            net: netReturn(trade.returnPct),
            riskPct: trade.riskPct!,
            open: trade.outcome === "open",
            marks: trade.dailyReturns ?? [],
          });
        }
        return trades;
      };
      return { trend: convert("trend"), fixed: convert("fixed") };
    } catch (error) {
      failed += 1;
      if (failures.length < 3)
        failures.push(
          `${row.code}: ${error instanceof Error ? error.message : "读取失败"}`,
        );
      return { trend: [] as BookTrade[], fixed: [] as BookTrade[] };
    } finally {
      finished += 1;
      if (long && (finished % 25 === 0 || finished === names.length)) {
        console.log(`[20y] ${finished}/${names.length} failed ${failed}`);
      }
    }
  });

  if (names.length > 0 && failed === names.length)
    throw new Error("日线源暂时没有回应");

  const aligned = books.flatMap((book) => book.trend);
  const stats = simulateBook(aligned, regime.byDate, calendar);
  const comparison = simulateBook(
    books.flatMap((book) => book.fixed),
    regime.byDate,
    calendar,
  );
  const signalFrom = aligned.reduce(
    (min, trade) => (trade.signalDate < min ? trade.signalDate : min),
    "9999-99-99",
  );
  const report: StrategyReport = {
    ...stats,
    version: "v2",
    generatedAt: new Date().toISOString(),
    exitMode: "trend",
    comparison,
    warnings: [
      "当前成交额股票池的历史重放，包含幸存者与选样偏差；不是历史全市场回测。",
      "价格按前复权处理；涨跌停为简化模型，未还原全部历史特殊规则。",
      "名义成交额来自未复权价格×成交量的近似值，非逐笔成交额。",
      "胜率与笔均收益仅统计已平仓交易；期末持仓按市价计入净值。",
      "以连续仓位比例估算，未模拟整手取整、最低佣金及盘口容量。",
      ...failures.map((error) => `样本排除：${error}`),
    ],
    from: calendar[0] ?? "",
    to: calendar[calendar.length - 1] ?? "",
    signalFrom: signalFrom.startsWith("9999") ? "" : signalFrom,
    universeSize: names.length,
    scanned: names.length - failed,
    failed,
    signals: aligned.length,
    rejected,
    riskOffDays: regime.riskOffDays,
    regime: regime.snapshot,
  };
  cache.set(key, { at: Date.now(), report });
  return report;
}
