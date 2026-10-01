import {
  NORMAL_SLOTS,
  RISK_OFF_ENTRY_SCORE,
  RISK_OFF_SLOTS,
  SLOT_WEIGHT,
  BUY_COST,
  SELL_COST,
} from "./gates";

export type BookTrade = {
  code: string;
  signalDate: string;
  entryDate: string;
  exitDate: string;
  score: number;
  gross: number;
  net: number;
  riskPct: number;
  open: boolean;
  marks: { date: string; gross: number }[];
};
export type EquityPoint = { date: string; equity: number };
export type StrategyStats = {
  taken: number;
  closed: number;
  open: number;
  skippedRegime: number;
  skippedSlot: number;
  winRate: number;
  avgNet: number;
  avgGross: number;
  payoff: number;
  totalReturn: number;
  annualized: number;
  maxDrawdown: number;
  curve: EquityPoint[];
};
const RISK_BUDGET = 0.005;
const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

/** Daily marked equity. Decisions and risk sizing use the previous close only. */
export function simulateBook(
  trades: BookTrade[],
  regime: Record<string, boolean>,
  calendar: string[],
): StrategyStats {
  const byEntry = new Map<string, BookTrade[]>();
  for (const trade of trades) {
    const group = byEntry.get(trade.entryDate) ?? [];
    group.push(trade);
    byEntry.set(trade.entryDate, group);
  }
  for (const list of byEntry.values())
    list.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
  const positions: {
    trade: BookTrade;
    notional: number;
    cost: number;
    mark: number;
    marks: Map<string, number>;
  }[] = [];
  const closed: number[] = [],
    grosses: number[] = [];
  const curve: EquityPoint[] = [];
  let cash = 1,
    previousEquity = 1,
    taken = 0,
    skippedRegime = 0,
    skippedSlot = 0;
  for (const date of calendar) {
    let opened = 0;
    // Buy at the open before receiving proceeds from today's later exits.
    for (const trade of byEntry.get(date) ?? []) {
      const riskOff = regime[trade.signalDate] ?? false;
      const cap = riskOff ? RISK_OFF_SLOTS : NORMAL_SLOTS;
      if (
        riskOff &&
        (trade.score < RISK_OFF_ENTRY_SCORE ||
          opened >= 1 ||
          positions.length >= cap)
      ) {
        skippedRegime += 1;
        continue;
      }
      if (
        positions.length >= cap ||
        positions.some((p) => p.trade.code === trade.code)
      ) {
        skippedSlot += 1;
        continue;
      }
      // Budget includes the initial stop distance and estimated round-trip costs.
      const weight = Math.min(
        SLOT_WEIGHT,
        RISK_BUDGET / (trade.riskPct + BUY_COST + SELL_COST),
      );
      const notional = Math.min(previousEquity * weight, cash / (1 + BUY_COST));
      if (!(notional > previousEquity * 0.001)) {
        skippedSlot += 1;
        continue;
      }
      const cost = notional * (1 + BUY_COST);
      cash -= cost;
      positions.push({
        trade,
        notional,
        cost,
        mark: notional,
        marks: new Map(trade.marks.map((m) => [m.date, m.gross])),
      });
      taken += 1;
      opened += 1;
    }
    for (let i = positions.length - 1; i >= 0; i -= 1) {
      const p = positions[i];
      if (!p.trade.open && p.trade.exitDate <= date) {
        cash += p.notional * (1 + p.trade.gross) * (1 - SELL_COST);
        closed.push(p.trade.net);
        grosses.push(p.trade.gross);
        positions.splice(i, 1);
      } else {
        const gross = p.marks.get(date);
        if (gross != null) p.mark = p.notional * (1 + gross);
      }
    }
    previousEquity = cash + positions.reduce((sum, p) => sum + p.mark, 0);
    curve.push({ date, equity: previousEquity });
  }
  let peak = 1,
    maxDrawdown = 0;
  for (const p of curve) {
    peak = Math.max(peak, p.equity);
    maxDrawdown = Math.min(maxDrawdown, p.equity / peak - 1);
  }
  const wins = closed.filter((x) => x > 0),
    losses = closed.filter((x) => x < 0);
  const first = calendar[0],
    last = calendar.at(-1);
  const years =
    first && last
      ? (Date.parse(last) - Date.parse(first)) / (365.25 * 86400000)
      : 0;
  const step = Math.max(1, Math.ceil(curve.length / 180));
  return {
    taken,
    closed: closed.length,
    open: positions.length,
    skippedRegime,
    skippedSlot,
    winRate: closed.length ? wins.length / closed.length : 0,
    avgNet: mean(closed),
    avgGross: mean(grosses),
    payoff: losses.length ? mean(wins) / Math.abs(mean(losses)) : 0,
    totalReturn: previousEquity - 1,
    annualized:
      years > 0.25 && previousEquity > 0
        ? previousEquity ** (1 / years) - 1
        : previousEquity - 1,
    maxDrawdown,
    curve: curve.filter((_, i) => i % step === 0 || i === curve.length - 1),
  };
}
