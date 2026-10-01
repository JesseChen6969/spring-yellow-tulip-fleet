import { NORMAL_SLOTS, RISK_OFF_ENTRY_SCORE, RISK_OFF_SLOTS, SLOT_WEIGHT } from "@/lib/market/gates";

export type BookTrade = {
  code: string;
  signalDate: string;
  exitDate: string;
  score: number;
  gross: number;
  net: number;
};

export type EquityPoint = {
  date: string;
  equity: number;
};

export type StrategyStats = {
  taken: number;
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

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleCurve(curve: EquityPoint[], max = 90) {
  if (curve.length <= max) return curve;
  const step = Math.ceil(curve.length / max);
  const sampled: EquityPoint[] = [];
  for (let index = 0; index < curve.length; index += step) sampled.push(curve[index]);
  const last = curve[curve.length - 1];
  if (sampled[sampled.length - 1]?.date !== last.date) sampled.push(last);
  return sampled;
}

export function simulateBook(
  trades: BookTrade[],
  regime: Record<string, boolean>,
  calendar: string[],
): StrategyStats {
  const byEntry = new Map<string, BookTrade[]>();
  for (const trade of trades) {
    const list = byEntry.get(trade.signalDate) ?? [];
    list.push(trade);
    byEntry.set(trade.signalDate, list);
  }
  for (const list of byEntry.values()) list.sort((a, b) => b.score - a.score);

  let cash = 1;
  const open: { code: string; cost: number; exitDate: string; net: number }[] = [];
  const curve: EquityPoint[] = [];
  const closed: number[] = [];
  const grosses: number[] = [];
  let taken = 0;
  let skippedRegime = 0;
  let skippedSlot = 0;

  const equityNow = () => cash + open.reduce((sum, position) => sum + position.cost, 0);

  for (const date of calendar) {
    for (let index = open.length - 1; index >= 0; index -= 1) {
      if (open[index].exitDate > date) continue;
      const position = open[index];
      cash += position.cost * (1 + position.net);
      closed.push(position.net);
      open.splice(index, 1);
    }

    const due = byEntry.get(date) ?? [];
    const riskOff = regime[date] ?? false;
    const cap = riskOff ? RISK_OFF_SLOTS : NORMAL_SLOTS;
    let opened = 0;
    for (const trade of due) {
      if (riskOff && (trade.score < RISK_OFF_ENTRY_SCORE || opened >= 1)) {
        skippedRegime += 1;
        continue;
      }
      const sameName = open.some((position) => position.code === trade.code);
      if (open.length >= cap || sameName) {
        if (riskOff && !sameName) skippedRegime += 1;
        else skippedSlot += 1;
        continue;
      }
      const budget = equityNow() * SLOT_WEIGHT;
      if (!(budget > 0) || cash + 1e-9 < budget) {
        skippedSlot += 1;
        continue;
      }
      cash -= budget;
      open.push({ code: trade.code, cost: budget, exitDate: trade.exitDate, net: trade.net });
      grosses.push(trade.gross);
      taken += 1;
      opened += 1;
    }
    curve.push({ date, equity: equityNow() });
  }

  for (const position of open) {
    cash += position.cost * (1 + position.net);
    closed.push(position.net);
  }
  if (calendar.length) curve.push({ date: calendar[calendar.length - 1], equity: cash });

  let peak = 1;
  let maxDrawdown = 0;
  for (const point of curve) {
    peak = Math.max(peak, point.equity);
    maxDrawdown = Math.min(maxDrawdown, point.equity / peak - 1);
  }

  const totalReturn = cash - 1;
  const sessions = Math.max(1, calendar.length);
  const years = sessions / 242;
  const annualized =
    cash > 0 && years > 0.25 ? (cash ** (1 / years)) - 1 : totalReturn;
  const wins = closed.filter((value) => value > 0);
  const losses = closed.filter((value) => value < 0);
  const avgGain = mean(wins);
  const avgLoss = mean(losses);

  return {
    taken,
    skippedRegime,
    skippedSlot,
    winRate: closed.length ? wins.length / closed.length : 0,
    avgNet: mean(closed),
    avgGross: mean(grosses),
    payoff: avgLoss < 0 ? avgGain / Math.abs(avgLoss) : 0,
    totalReturn,
    annualized,
    maxDrawdown,
    curve: sampleCurve(curve.filter((point) => point.date)),
  };
}
