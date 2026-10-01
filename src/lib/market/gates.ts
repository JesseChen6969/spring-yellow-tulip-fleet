import { boardOf, type Bar } from "@/lib/pattern/adam-eve";

export const MIN_AMOUNT = 80_000_000;
export const MIN_LISTED_BARS = 60;
export const LIVE_SCORE = 46;
export const RISK_OFF_LIVE_SCORE = 72;
export const RISK_OFF_ENTRY_SCORE = 76;
export const NORMAL_SLOTS = 8;
export const RISK_OFF_SLOTS = 3;
export const SLOT_WEIGHT = 0.125;

const BUY_COST = 0.00025 + 0.001;
const SELL_COST = 0.00025 + 0.0005 + 0.001;

export function blockedName(name: string) {
  const text = name.replace(/\s+/g, "").toUpperCase();
  if (text.includes("ST")) return true;
  if (text.includes("退")) return true;
  if (text.startsWith("N") || text.startsWith("C")) return true;
  return false;
}

export function limitPct(code: string) {
  const board = boardOf(code);
  if (board === "chinext" || board === "star") return 0.2;
  return 0.1;
}

export function averageAmount(bars: Bar[], end: number, lookback = 20) {
  const start = Math.max(0, end - lookback);
  let sum = 0;
  let count = 0;
  for (let index = start; index < end; index += 1) {
    sum += bars[index].amount;
    count += 1;
  }
  return count ? sum / count : 0;
}

export function isOneWordLimitUp(prev: Bar, bar: Bar, limit: number) {
  if (!(prev.close > 0)) return false;
  const ceiling = prev.close * (1 + limit);
  return bar.open >= ceiling * 0.997 && bar.low >= ceiling * 0.997;
}

export function netReturn(gross: number) {
  if (!Number.isFinite(gross)) return 0;
  return ((1 + gross) * (1 - SELL_COST)) / (1 + BUY_COST) - 1;
}

export type GateCode = "name" | "ipo" | "halt" | "limit" | "amount";

export function liveGate(code: string, name: string, bars: Bar[], marketDate: string): GateCode | null {
  if (blockedName(name)) return "name";
  if (bars.length < MIN_LISTED_BARS) return "ipo";
  const last = bars[bars.length - 1];
  if (!last || last.volume <= 0) return "halt";
  if (marketDate && last.date < marketDate) return "halt";
  if (averageAmount(bars, bars.length, 20) < MIN_AMOUNT) return "amount";
  const prev = bars[bars.length - 2];
  if (prev && isOneWordLimitUp(prev, last, limitPct(code))) return "limit";
  return null;
}

export function entryGate(code: string, bars: Bar[], index: number, young: boolean): GateCode | null {
  if (young && index < MIN_LISTED_BARS) return "ipo";
  if (index < 21) return "amount";
  const bar = bars[index];
  const prev = bars[index - 1];
  if (!bar || bar.volume <= 0) return "halt";
  if (isOneWordLimitUp(prev, bar, limitPct(code))) return "limit";
  if (averageAmount(bars, index, 20) < MIN_AMOUNT) return "amount";
  return null;
}

export const GATE_LABEL: Record<GateCode, string> = {
  name: "ST、*ST 或退市整理，不进股票池。",
  ipo: "上市不足 60 个交易日。",
  halt: "停牌或当日没有成交。",
  limit: "一字涨停，按买不进处理。",
  amount: "近 20 日日均成交额低于 8000 万。",
};

export type IndexState = {
  riskOff: boolean;
  gap: number;
};

export function markIndex(bars: Bar[]) {
  const map = new Map<string, IndexState>();
  for (let index = 24; index < bars.length; index += 1) {
    let sum = 0;
    for (let cursor = index - 19; cursor <= index; cursor += 1) sum += bars[cursor].close;
    const ma = sum / 20;
    let prev = 0;
    for (let cursor = index - 24; cursor <= index - 5; cursor += 1) prev += bars[cursor].close;
    const maPrev = prev / 20;
    const gap = ma > 0 ? bars[index].close / ma - 1 : 0;
    map.set(bars[index].date, { riskOff: gap <= -0.03 && ma < maPrev, gap });
  }
  return map;
}

export type RegimeSnapshot = {
  riskOff: boolean;
  detail: string;
  asOf: string;
};

export function describeRegime(shanghai: Bar[], csi: Bar[]): {
  byDate: Record<string, boolean>;
  snapshot: RegimeSnapshot;
  riskOffDays: number;
  sessions: number;
} {
  const sh = markIndex(shanghai);
  const cs = markIndex(csi);
  const byDate: Record<string, boolean> = {};
  let riskOffDays = 0;
  for (const bar of csi) {
    const flag = (sh.get(bar.date)?.riskOff ?? false) || (cs.get(bar.date)?.riskOff ?? false);
    byDate[bar.date] = flag;
    if (flag) riskOffDays += 1;
  }
  const asOf = csi[csi.length - 1]?.date ?? shanghai[shanghai.length - 1]?.date ?? "";
  const shNow = sh.get(asOf);
  const csNow = cs.get(asOf);
  const parts: string[] = [];
  if (csNow?.riskOff) parts.push(`沪深300在20日线下方 ${(Math.abs(csNow.gap) * 100).toFixed(1)}%，均线向下`);
  if (shNow?.riskOff) parts.push(`上证指数在20日线下方 ${(Math.abs(shNow.gap) * 100).toFixed(1)}%，均线向下`);
  const riskOff = parts.length > 0;
  return {
    byDate,
    riskOffDays,
    sessions: csi.length,
    snapshot: {
      riskOff,
      asOf,
      detail: riskOff
        ? `${parts.join("；")}。只保留评分不低于 ${RISK_OFF_LIVE_SCORE} 的信号。`
        : "上证和沪深300都没有处在20日线下方的单边下跌。",
    },
  };
}
