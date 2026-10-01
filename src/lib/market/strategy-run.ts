import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { backtestAdamEve, backtestEveAdam, boardOf } from "@/lib/pattern/adam-eve";
import {
  blockedName,
  describeRegime,
  entryGate,
  netReturn,
  type GateCode,
  type RegimeSnapshot,
} from "@/lib/market/gates";
import { cleanName, loadBars, loadLongBars, loadLongSymbol, loadSymbol, loadUniverse, mapPool } from "@/lib/market/quotes";
import { simulateBook, type BookTrade, type StrategyStats } from "@/lib/market/strategy";

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
};

const UNIVERSE = 200;
const HISTORY = 640;
const LONG_START = "2006-09-23";
const LONG_CACHE = "/workspace/.cache/eve-adam-20y.json";
const LONG_VERSION = "eve-20y-v1";

export type Span = "2y" | "20y";

let cache = new Map<string, { at: number; report: StrategyReport }>();
const TTL = 30 * 60 * 1000;

function snapForward(date: string, calendar: string[]) {
  for (const day of calendar) {
    if (day >= date) return day;
  }
  return null;
}

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
  if (long && !force) {
    const saved = readLongReport();
    if (saved) return saved;
  }
  const cached = cache.get(key);
  if (!force && cached && Date.now() - cached.at < TTL) return cached.report;

  const [names, shanghai, csi] = await Promise.all([
    liquidNames(universe),
    long ? loadLongSymbol("sh000001", LONG_START) : loadSymbol("sh000001", HISTORY),
    long ? loadLongSymbol("sh000300", LONG_START) : loadSymbol("sh000300", HISTORY),
  ]);
  if (csi.length < 80) throw new Error("沪深300日线不足，回测停住了");
  const regime = describeRegime(shanghai, csi);
  const rejected: Record<GateCode, number> = { name: 0, ipo: 0, halt: 0, limit: 0, amount: 0 };
  let failed = 0;
  let finished = 0;

  const books = await mapPool(names, long ? 4 : 8, async (row) => {
    try {
      const loaded = long ? await loadLongBars(row.code, LONG_START) : await loadBars(row.code, HISTORY);
      const name = cleanName(loaded.name || row.name);
      if (blockedName(name)) {
        rejected.name += 1;
        return [] as BookTrade[];
      }
      const first = loaded.bars[0]?.date ?? "9999-99-99";
      const young = long ? first > "2007-01-01" : loaded.bars.length < 500;
      const history = (book === "eve-adam" ? backtestEveAdam : backtestAdamEve)(loaded.bars);
      const trades: BookTrade[] = [];
      for (const trade of history) {
        const index = trade.pattern.breakoutIndex;
        if (index == null || trade.outcome === "missed") continue;
        const reason = entryGate(row.code, loaded.bars, index, young);
        if (reason) {
          rejected[reason] += 1;
          continue;
        }
        trades.push({
          code: row.code,
          signalDate: trade.signalDate,
          exitDate: trade.exitDate,
          score: trade.pattern.score,
          gross: trade.returnPct,
          net: netReturn(trade.returnPct),
        });
      }
      return trades;
    } catch {
      failed += 1;
      return [] as BookTrade[];
    } finally {
      finished += 1;
      if (long && (finished % 25 === 0 || finished === names.length)) {
        console.log(`[20y] ${finished}/${names.length} failed ${failed}`);
      }
    }
  });

  if (names.length > 0 && failed === names.length) throw new Error("日线源暂时没有回应");

  const trades = books.flat();
  const calendar = csi.map((bar) => bar.date);
  const aligned = trades.flatMap((trade) => {
    const signalDate = snapForward(trade.signalDate, calendar);
    let exitDate = snapForward(trade.exitDate, calendar);
    if (!signalDate || !exitDate) return [];
    if (exitDate <= signalDate) {
      exitDate = calendar[calendar.indexOf(signalDate) + 1] ?? null;
    }
    if (!exitDate) return [];
    return [{ ...trade, signalDate, exitDate }];
  });
  const stats = simulateBook(aligned, regime.byDate, calendar);
  const signalFrom = aligned.reduce((min, trade) => (trade.signalDate < min ? trade.signalDate : min), "9999-99-99");
  const report: StrategyReport = {
    ...stats,
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
  if (long) writeLongReport(report);
  return report;
}

function readLongReport(): StrategyReport | null {
  try {
    const raw = JSON.parse(readFileSync(LONG_CACHE, "utf8")) as { version?: string; report?: StrategyReport };
    if (raw.version !== LONG_VERSION || !raw.report?.from) return null;
    return raw.report;
  } catch {
    return null;
  }
}

function writeLongReport(report: StrategyReport) {
  mkdirSync("/workspace/.cache", { recursive: true });
  writeFileSync(LONG_CACHE, JSON.stringify({ version: LONG_VERSION, report }));
}
