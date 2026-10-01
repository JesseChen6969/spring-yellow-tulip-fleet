import { createServerFn } from "@tanstack/react-start";
import {
  backtestAdamEve,
  backtestEveAdam,
  boardOf,
  detectAdamEve,
  detectEveAdam,
  marketMetrics,
  type Bar,
  type PastTrade,
  type Pattern,
} from "@/lib/pattern/adam-eve";
import {
  GATE_LABEL,
  LIVE_SCORE,
  RISK_OFF_LIVE_SCORE,
  blockedName,
  describeRegime,
  liveGate,
  type RegimeSnapshot,
} from "@/lib/market/gates";
import {
  cleanName,
  loadBars,
  loadSymbol,
  loadUniverse,
  mapPool,
  type QuoteRow,
} from "@/lib/market/quotes";
import {
  runStrategyBacktest,
  type Span,
  type StrategyReport,
} from "@/lib/market/strategy-run";

export type { Span, StrategyReport } from "@/lib/market/strategy-run";
export type { RegimeSnapshot } from "@/lib/market/gates";

export type Board = "main" | "chinext" | "star";

export type Book = "adam-eve" | "eve-adam";

export type ScanInput = {
  refresh?: boolean;
  size: 60 | 100;
  depth: 800 | 1600;
  boards: Board[];
  code: string;
  book: Book;
};

export type ScanHit = {
  code: string;
  name: string;
  board: Board | "other";
  amount: number;
  bars: Bar[];
  pattern: Pattern | null;
  price: number;
  changePct: number;
  atr: number;
  atrPct: number;
  ma: number;
  ma60: number;
  atrMultipleFromMa: number;
  gainFromMaPct: number;
  volVsAvg: number;
  rvol: number;
  history?: PastTrade[];
  gate?: string | null;
};

export type ScanResult = {
  scanned: number;
  failed: number;
  asOf: string;
  universe: string;
  hits: ScanHit[];
  focus: ScanHit | null;
  regime: RegimeSnapshot | null;
  fetchedAt: string;
  dataPolicy: string;
};

function present(
  code: string,
  name: string,
  amount: number,
  bars: Bar[],
  pattern: Pattern | null,
  full = false,
): ScanHit {
  const metrics = marketMetrics(bars);
  const start = full
    ? 0
    : pattern
      ? Math.max(0, pattern.adamIndex - 16)
      : Math.max(0, bars.length - 140);
  const view = bars.slice(start);
  const shift = (index: number | null) =>
    index == null ? null : index - start;
  const shifted: Pattern | null = pattern
    ? {
        ...pattern,
        adamIndex: pattern.adamIndex - start,
        eveIndex: pattern.eveIndex - start,
        neckIndex: pattern.neckIndex - start,
        breakoutIndex: shift(pattern.breakoutIndex),
        retestIndex: shift(pattern.retestIndex),
      }
    : null;
  const price = metrics?.price ?? view[view.length - 1]?.close ?? 0;
  return {
    code,
    name: cleanName(name),
    board: boardOf(code),
    amount,
    bars: view,
    pattern: shifted,
    price,
    changePct: metrics?.changePct ?? 0,
    atr: metrics?.atr ?? 0,
    atrPct: metrics?.atrPct ?? 0,
    ma: metrics?.ma ?? price,
    ma60: metrics?.ma60 ?? price,
    atrMultipleFromMa: metrics?.atrMultipleFromMa ?? 0,
    gainFromMaPct: metrics?.gainFromMaPct ?? 0,
    volVsAvg: metrics?.volVsAvg ?? 0,
    rvol: shifted?.rvol ?? metrics?.rvol ?? 0,
  };
}

function engine(book: Book) {
  return book === "eve-adam"
    ? { detect: detectEveAdam, history: backtestEveAdam }
    : { detect: detectAdamEve, history: backtestAdamEve };
}

function parseBook(value: unknown): Book {
  return value === "eve-adam" ? "eve-adam" : "adam-eve";
}
function parseInput(input: unknown): ScanInput {
  const raw = (input ?? {}) as Partial<ScanInput>;
  const size = raw.size === 100 ? 100 : 60;
  const allowed = new Set<Board>(["main", "chinext", "star"]);
  const boards = Array.isArray(raw.boards)
    ? raw.boards.filter((board): board is Board => allowed.has(board as Board))
    : [];
  const code =
    typeof raw.code === "string" ? raw.code.replace(/\D/g, "").slice(0, 6) : "";
  const depth = raw.depth === 1600 ? 1600 : 800;
  return {
    size,
    refresh: raw.refresh === true,
    depth,
    boards: boards.length ? boards : ["main", "chinext", "star"],
    code,
    book: parseBook(raw.book),
  };
}

async function marketContext() {
  try {
    const [shanghai, csi] = await Promise.all([
      loadSymbol("sh000001", 80),
      loadSymbol("sh000300", 80),
    ]);
    const sessions = csi.length >= 30 ? csi : shanghai;
    if (sessions.length < 30) return null;
    const described = describeRegime(shanghai, csi);
    const marketDate = sessions[sessions.length - 1].date;
    return { snapshot: described.snapshot, marketDate };
  } catch {
    return null;
  }
}

function passesPool(
  row: QuoteRow,
  input: ScanInput,
  node: string,
  allBoards: boolean,
) {
  const name = cleanName(String(row.name || ""));
  if (!row.code || blockedName(name)) return false;
  const board = boardOf(row.code);
  if (board === "other") return false;
  if (!allBoards && node === "hs_a" && !input.boards.includes(board as Board))
    return false;
  return true;
}

async function loadRanked(node: string, limit: number) {
  const pageSize = 100;
  const pages = Math.ceil((limit + 40) / pageSize);
  const batches = await mapPool(
    Array.from({ length: pages }, (_, index) => index + 1),
    4,
    (page) => loadUniverse(node, pageSize, page),
  );
  const seen = new Set<string>();
  const rows: QuoteRow[] = [];
  for (const batch of batches) {
    for (const row of batch) {
      if (!row?.code || seen.has(row.code)) continue;
      seen.add(row.code);
      rows.push(row);
      if (rows.length >= limit + 40) return rows;
    }
  }
  return rows;
}

async function runScan(input: ScanInput): Promise<ScanResult> {
  const context = await marketContext();
  const regime = context?.snapshot ?? null;
  const marketDate = context?.marketDate ?? "";

  if (input.code) {
    if (input.code.length !== 6) throw new Error("请输入 6 位 A 股代码");
    const picked = engine(input.book);
    const loaded = await loadBars(input.code, 640, input.refresh);
    const history = picked.history(loaded.bars, "trend", input.code);
    const pattern = picked.detect(loaded.bars);
    const focus = present(
      input.code,
      loaded.name,
      0,
      loaded.bars,
      pattern,
      true,
    );
    focus.history = history;
    const gate = liveGate(input.code, focus.name, loaded.bars, marketDate);
    focus.gate = gate ? GATE_LABEL[gate] : null;
    return {
      scanned: 1,
      failed: 0,
      asOf: loaded.bars[loaded.bars.length - 1]?.date ?? "",
      universe: input.book === "eve-adam" ? "逆向单票" : "单票",
      hits: pattern && !gate ? [focus] : [],
      focus,
      regime,
      fetchedAt: new Date(loaded.at).toISOString(),
      dataPolicy: "仅使用已完成日线；收盘后16:00确认。",
    };
  }

  const allBoards = input.boards.length === 3;
  const only = input.boards.length === 1 ? input.boards[0] : null;
  const node = only === "star" ? "kcb" : only === "chinext" ? "cyb" : "hs_a";
  const rows =
    input.book === "eve-adam"
      ? await loadRanked(node, input.depth)
      : await loadUniverse(node, input.size);
  const selected = rows.filter((row) =>
    passesPool(row, input, node, allBoards),
  );
  const pool =
    input.book === "eve-adam" ? selected.slice(0, input.depth) : selected;
  const picked = engine(input.book);
  const floor = regime?.riskOff ? RISK_OFF_LIVE_SCORE : LIVE_SCORE;

  let failed = 0;
  let firstError = "";
  const scanned = await mapPool(
    pool,
    input.book === "eve-adam" ? 12 : 8,
    async (row) => {
      try {
        const loaded = await loadBars(row.code, 170, input.refresh);
        const name = cleanName(loaded.name || row.name);
        const gate = liveGate(row.code, name, loaded.bars, marketDate);
        if (gate) return null;
        const pattern = picked.detect(loaded.bars);
        if (!pattern || pattern.score < floor) return null;
        return present(
          row.code,
          name,
          Number(row.amount) || 0,
          loaded.bars,
          pattern,
        );
      } catch (error) {
        failed += 1;
        if (!firstError)
          firstError = error instanceof Error ? error.message : "日线读取失败";
        return null;
      }
    },
  );

  if (pool.length > 0 && failed === pool.length) {
    throw new Error(firstError || "日线源暂时没有回应");
  }

  const hits = scanned
    .filter((hit): hit is ScanHit => hit != null)
    .sort((a, b) => (b.pattern?.score ?? 0) - (a.pattern?.score ?? 0));

  return {
    scanned: pool.length,
    failed,
    asOf: hits[0]?.bars[hits[0].bars.length - 1]?.date ?? marketDate,
    universe:
      input.book === "eve-adam"
        ? `流动性池 ${pool.length} · 不限当日前列`
        : node === "kcb"
          ? "科创板成交额"
          : node === "cyb"
            ? "创业板成交额"
            : "沪深 A 成交额",
    hits,
    focus: hits[0] ?? null,
    regime,
    fetchedAt: new Date().toISOString(),
    dataPolicy: "仅使用已完成日线；个股缓存最长8分钟，手动扫描绕过缓存。",
  };
}

export const scanMarket = createServerFn({ method: "POST" })
  .validator((input: unknown) => parseInput(input))
  .handler(async ({ data }) => runScan(data));

export const backtestStrategy = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = (input ?? {}) as {
      refresh?: boolean;
      book?: Book;
      span?: Span;
    };
    const book = parseBook(raw.book);
    const span: Span = book === "eve-adam" && raw.span === "20y" ? "20y" : "2y";
    return { refresh: raw.refresh === true, book, span };
  })
  .handler(async ({ data }) =>
    runStrategyBacktest(
      data.refresh,
      data.book === "eve-adam" ? 500 : undefined,
      data.book,
      data.span,
    ),
  );
