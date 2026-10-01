export type Bar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** Turnover in yuan. */
  amount: number;
};

export type Stage = "forming" | "breakout" | "retest" | "extended";

export type Pattern = {
  score: number;
  /** First date on which the complete signal was observable. */
  signalIndex?: number;
  stage: Stage;
  adamIndex: number;
  eveIndex: number;
  neckIndex: number;
  adamLow: number;
  eveLow: number;
  neckline: number;
  breakoutIndex: number | null;
  retestIndex: number | null;
  adamWidth: number;
  eveWidth: number;
  priorDrop: number;
  rebound: number;
  lowGap: number;
  spike: number;
  entry: number;
  stop: number;
  target: number;
  rewardRisk: number;
  rvol: number;
  atr: number;
  atrPct: number;
  ma: number;
  ma60: number;
  atrMultipleFromMa: number;
  gainFromMaPct: number;
  volVsAvg: number;
};

const STAGE_BIAS: Record<Stage, number> = {
  retest: 10,
  breakout: 8,
  forming: 5,
  extended: -4,
};

function basin(
  bars: Bar[],
  index: number,
  pct: number,
  minLeft: number,
  maxRight: number,
) {
  const cap = bars[index].low * (1 + pct);
  let left = index;
  let right = index;
  while (left > minLeft && bars[left - 1].low <= cap) left -= 1;
  while (right < maxRight && bars[right + 1].low <= cap) right += 1;
  return { left, right, width: right - left + 1 };
}

function swingLows(bars: Bar[], width: number) {
  const found: number[] = [];
  for (let i = width; i < bars.length - width; i += 1) {
    let pivot = true;
    for (let k = i - width; k <= i + width; k += 1) {
      if (k !== i && bars[k].low < bars[i].low) {
        pivot = false;
        break;
      }
    }
    if (pivot) found.push(i);
  }
  const merged: number[] = [];
  for (const index of found) {
    const last = merged[merged.length - 1];
    if (last != null && index - last < 5) {
      if (bars[index].low < bars[last].low) merged[merged.length - 1] = index;
    } else {
      merged.push(index);
    }
  }
  return merged;
}

function averageVolume(bars: Bar[], end: number, lookback = 20) {
  const start = Math.max(0, end - lookback);
  let sum = 0;
  let count = 0;
  for (let i = start; i < end; i += 1) {
    sum += bars[i].volume;
    count += 1;
  }
  return count ? sum / count : 0;
}

export function wilderAtr(bars: Bar[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  const tr: number[] = [];
  for (let i = 0; i < bars.length; i += 1) {
    if (i === 0) {
      tr.push(bars[i].high - bars[i].low);
      continue;
    }
    const prev = bars[i - 1].close;
    tr.push(
      Math.max(
        bars[i].high - bars[i].low,
        Math.abs(bars[i].high - prev),
        Math.abs(bars[i].low - prev),
      ),
    );
  }
  let value = 0;
  for (let i = 0; i < period; i += 1) value += tr[i];
  value /= period;
  for (let i = period; i < tr.length; i += 1) {
    value = (value * (period - 1) + tr[i]) / period;
  }
  return value;
}

export function sma(bars: Bar[], period: number): number | null {
  if (bars.length < period) return null;
  let sum = 0;
  for (let i = bars.length - period; i < bars.length; i += 1)
    sum += bars[i].close;
  return sum / period;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export type ExitMode = "fixed" | "trend";
const HORIZON = 30;
const TREND_HORIZON = 120;

export type TradeOutcome = "target" | "stop" | "expired" | "open" | "missed";

export type PastTrade = {
  pattern: Pattern;
  outcome: TradeOutcome;
  signalDate: string;
  exitDate: string;
  holdDays: number;
  returnPct: number;
  exitPrice: number;
  entryDate?: string;
  riskPct?: number;
  exitMode?: ExitMode;
  dailyReturns?: { date: string; gross: number }[];
};

export const OUTCOME_LABEL: Record<TradeOutcome, string> = {
  target: "先到目标",
  stop: "止损/跟踪退出",
  expired: "到期未触及",
  open: "进行中",
  missed: "未成交",
};

/**
 * Adam & Eve double bottom.
 * Adam is the first, narrow V. Eve is the later, wider U.
 * Neckline is the peak between them. Entry is a close through that line.
 * `archive` keeps older setups instead of only the one still in play.
 */
function collectPatterns(bars: Bar[], archive: boolean): Pattern[] {
  if (bars.length < 70) return [];
  const last = bars.length - 1;
  const pivots = swingLows(bars, 3).filter(
    (index) => index > 20 && index < last - 2,
  );
  const found: Pattern[] = [];
  let best: Pattern | null = null;

  for (let a = 0; a < pivots.length; a += 1) {
    for (let e = a + 1; e < pivots.length; e += 1) {
      const adamIndex = pivots[a];
      const eveIndex = pivots[e];
      const span = eveIndex - adamIndex;
      if (span < 8 || span > 70) continue;
      if (!archive && last - eveIndex > 40) continue;

      const adamLow = bars[adamIndex].low;
      const eveLow = bars[eveIndex].low;
      const midLow = (adamLow + eveLow) / 2;
      const lowGap = Math.abs(adamLow - eveLow) / midLow;
      if (lowGap > 0.055) continue;
      if (eveLow < adamLow * 0.975) continue;

      let neckIndex = adamIndex + 1;
      let neckline = -Infinity;
      for (let i = adamIndex + 1; i < eveIndex; i += 1) {
        if (bars[i].high > neckline) {
          neckline = bars[i].high;
          neckIndex = i;
        }
      }
      if (!Number.isFinite(neckline)) continue;
      const higherLow = Math.max(adamLow, eveLow);
      const rebound = (neckline - higherLow) / higherLow;
      if (rebound < 0.06 || rebound > 0.5) continue;

      const lookback = Math.max(0, adamIndex - 40);
      let priorHigh = -Infinity;
      for (let i = lookback; i < adamIndex - 2; i += 1) {
        if (bars[i].high > priorHigh) priorHigh = bars[i].high;
      }
      if (priorHigh <= 0) continue;
      const priorDrop = (priorHigh - adamLow) / priorHigh;
      if (priorDrop < 0.07) continue;

      const adamBasin = basin(
        bars,
        adamIndex,
        0.025,
        Math.max(0, adamIndex - 14),
        Math.max(adamIndex, neckIndex - 1),
      );
      const eveBasin = basin(
        bars,
        eveIndex,
        0.032,
        neckIndex,
        Math.min(last - 1, eveIndex + 16),
      );
      if (adamBasin.width > 9 || adamBasin.width < 1) continue;
      if (eveBasin.width < 6 || eveBasin.width > 26) continue;
      if (eveBasin.width < adamBasin.width + 3) continue;

      const neighbors = [
        adamIndex - 2,
        adamIndex - 1,
        adamIndex + 1,
        adamIndex + 2,
      ]
        .filter((index) => index >= 0 && index < bars.length)
        .map((index) => bars[index].low);
      const neighborAvg =
        neighbors.reduce((sum, value) => sum + value, 0) / neighbors.length;
      const spike = (neighborAvg - adamLow) / adamLow;
      if (spike < 0.006) continue;

      const eveLows = bars
        .slice(eveBasin.left, eveBasin.right + 1)
        .map((bar) => bar.low)
        .sort((x, y) => x - y);
      const eveMedian = eveLows[Math.floor(eveLows.length / 2)];
      const eveSpike = (eveMedian - eveLow) / eveLow;
      if (eveSpike > 0.04) continue;

      const floor = Math.min(adamLow, eveLow);
      const breakoutEnd = archive
        ? Math.min(bars.length, eveIndex + 36)
        : bars.length;
      let breakoutIndex: number | null = null;
      let killed = false;
      for (let i = eveIndex + 1; i < breakoutEnd; i += 1) {
        if (bars[i].close < floor * 0.972) {
          killed = true;
          break;
        }
        if (bars[i].close > neckline) {
          breakoutIndex = i;
          break;
        }
      }
      if (killed) continue;

      const lastClose = bars[last].close;
      const recent = last - eveIndex <= 40;
      let stage: Stage = "forming";
      let retestIndex: number | null = null;

      if (breakoutIndex == null) {
        if (!(archive && !recent)) {
          const distance = (neckline - lastClose) / neckline;
          if (distance < 0 || distance > 0.09) continue;
          if (lastClose < eveLow * 1.015) continue;
          if (last - eveIndex < 3) continue;
        }
        stage = "forming";
      } else if (archive) {
        const retestEnd = Math.min(last, breakoutIndex + 12);
        for (let i = breakoutIndex + 1; i <= retestEnd; i += 1) {
          const holds =
            bars[i].low <= neckline * 1.015 &&
            bars[i].low >= floor * 1.005 &&
            bars[i].close >= neckline * 0.992;
          if (holds) retestIndex = i;
        }
        stage = retestIndex != null ? "retest" : "breakout";
      } else {
        for (let i = breakoutIndex + 1; i <= last; i += 1) {
          const holds =
            bars[i].low <= neckline * 1.015 &&
            bars[i].low >= floor * 1.005 &&
            bars[i].close >= neckline * 0.992;
          if (holds) retestIndex = i;
        }
        const extension = (lastClose - neckline) / neckline;
        const since = last - breakoutIndex;
        if (lastClose < neckline * 0.985) continue;
        if (extension > 0.11 || since > 16) stage = "extended";
        else if (retestIndex != null && lastClose >= neckline * 0.998)
          stage = "retest";
        else stage = "breakout";
      }

      const compareAt = breakoutIndex ?? last;
      const baseAvg = averageVolume(bars, compareAt);
      const burst = bars[compareAt].volume;
      const rvol = baseAvg > 0 ? burst / baseAvg : 1;
      const adamVol = averageVolume(bars, adamIndex);

      const stop = floor * 0.99;
      const entry =
        archive && breakoutIndex != null
          ? bars[breakoutIndex].close
          : stage === "forming"
            ? neckline
            : lastClose;
      const target = neckline + (neckline - floor);
      const risk = entry - stop;
      const rewardRisk = risk > 0 ? (target - entry) / risk : 0;

      let score = 28;
      score += clamp((0.035 - lowGap) * 320, 0, 14);
      score += clamp((spike - 0.006) * 420, 0, 14);
      score += clamp((eveBasin.width - adamBasin.width - 2) * 1.15, 0, 12);
      score += priorDrop >= 0.12 && priorDrop <= 0.36 ? 8 : 3;
      score += rebound >= 0.1 && rebound <= 0.28 ? 8 : 3;
      score += STAGE_BIAS[stage];
      if (breakoutIndex != null && rvol >= 1.4) score += 8;
      else if (breakoutIndex != null && rvol >= 1.1) score += 3;
      if (adamVol > 0 && averageVolume(bars, eveIndex) < adamVol * 0.9)
        score += 4;
      if (stage === "forming" && !(archive && !recent)) {
        const distance = (neckline - lastClose) / neckline;
        score += clamp(6 - distance * 70, 0, 6);
      }
      if (!archive) {
        if (stage === "extended") score -= 6;
        if (rewardRisk < 0.6 && stage !== "forming") score -= 8;
        if (
          (stage === "breakout" || stage === "retest") &&
          last - (breakoutIndex ?? last) <= 2
        ) {
          score += 3;
        }
      }
      score = Math.round(clamp(score, 1, 99));

      const atr = wilderAtr(bars) ?? lastClose * 0.03;
      const ma = sma(bars, 20) ?? lastClose;
      const ma60 = sma(bars, 60) ?? ma;
      const recentAvg = averageVolume(bars, last) || 1;

      const pattern: Pattern = {
        score,
        stage,
        adamIndex,
        eveIndex,
        neckIndex,
        adamLow,
        eveLow,
        neckline,
        breakoutIndex,
        retestIndex,
        adamWidth: adamBasin.width,
        eveWidth: eveBasin.width,
        priorDrop,
        rebound,
        lowGap,
        spike,
        entry,
        stop,
        target,
        rewardRisk,
        rvol,
        atr,
        atrPct: atr / lastClose,
        ma,
        ma60,
        atrMultipleFromMa: (lastClose - ma) / atr,
        gainFromMaPct: (lastClose - ma) / ma,
        volVsAvg: bars[last].volume / recentAvg - 1,
      };

      if (archive) found.push(pattern);
      else if (!best || pattern.score > best.score) best = pattern;
    }
  }

  return archive ? found : best ? [best] : [];
}

export function detectAdamEve(bars: Bar[]): Pattern | null {
  return collectPatterns(bars, false)[0] ?? null;
}

/** Signals are frozen as each prefix becomes available; no later replacement. */
export function confirmedSignals(
  bars: Bar[],
  book: "adam-eve" | "eve-adam",
): Pattern[] {
  const signals: Pattern[] = [];
  const seen = new Set<string>();
  for (let end = 69; end < bars.length; end += 1) {
    const start = Math.max(0, end - 219);
    const prefix = bars.slice(start, end + 1);
    const last = prefix.length - 1;
    const candidates = (book === "eve-adam" ? collectEveAdam : collectPatterns)(
      prefix,
      true,
    )
      .filter(
        (p) =>
          p.breakoutIndex != null &&
          p.breakoutIndex >= last - 3 &&
          p.score >= 48 &&
          prefix[last].close > p.neckline &&
          prefix[last].close > p.stop,
      )
      .sort((a, b) => b.score - a.score || a.adamIndex - b.adamIndex);
    for (const p of candidates) {
      const key = bars[start + Math.max(p.adamIndex, p.eveIndex)].date;
      if (seen.has(key)) continue;
      seen.add(key);
      signals.push({
        ...p,
        signalIndex: end,
        adamIndex: p.adamIndex + start,
        eveIndex: p.eveIndex + start,
        neckIndex: p.neckIndex + start,
        breakoutIndex: p.breakoutIndex == null ? null : p.breakoutIndex + start,
        retestIndex: p.retestIndex == null ? null : p.retestIndex + start,
      });
    }
  }
  return signals;
}

/** Conservative open-price execution. A gap through a stop fills at the open. */
export function settleTrade(
  bars: Bar[],
  pattern: Pattern,
  mode: ExitMode = "trend",
  code = "",
): PastTrade {
  const signal =
    pattern.signalIndex ?? pattern.breakoutIndex ?? bars.length - 1;
  const entryIndex = signal + 1;
  const first = bars[entryIndex];
  const limit =
    boardOf(code) === "chinext" && bars[signal].date < "2020-08-24"
      ? 0.1
      : boardOf(code) === "chinext" || boardOf(code) === "star"
        ? 0.2
        : 0.1;
  const missed: PastTrade = {
    pattern,
    outcome: "missed",
    signalDate: bars[signal].date,
    exitDate: bars[signal].date,
    holdDays: 0,
    returnPct: 0,
    exitPrice: bars[signal].close,
    exitMode: mode,
  };
  if (
    !first ||
    first.volume <= 0 ||
    first.open <= pattern.stop ||
    (code && first.open >= bars[signal].close * (1 + limit) * 0.997) ||
    (mode === "fixed" && first.open >= pattern.target)
  )
    return missed;
  const entry = first.open;
  const riskPct = (entry - pattern.stop) / entry;
  if (!(riskPct > 0 && riskPct <= 0.2)) return missed;
  const horizon = mode === "trend" ? TREND_HORIZON : HORIZON;
  let stop = pattern.stop;
  let peak = entry;
  let exitIndex = bars.length - 1;
  let exitPrice = bars[exitIndex].close;
  let outcome: TradeOutcome = "open";
  let pendingExit = false;
  const dailyReturns: { date: string; gross: number }[] = [];
  for (let i = entryIndex; i < bars.length; i += 1) {
    const bar = bars[i];
    const previous = bars[i - 1];
    const dayLimit =
      boardOf(code) === "chinext" && bar.date < "2020-08-24"
        ? 0.1
        : boardOf(code) === "chinext" || boardOf(code) === "star"
          ? 0.2
          : 0.1;
    const lockedDown =
      !!code && bar.high <= previous.close * (1 - dayLimit) * 1.003;
    // T+1: no same-day sale; blocked exits remain pending until executable.
    const canSell = i > entryIndex && bar.volume > 0 && !lockedDown;
    if (canSell && (pendingExit || bar.low <= stop)) {
      exitPrice = pendingExit ? bar.open : Math.min(bar.open, stop);
      outcome = "stop";
      exitIndex = i;
    } else if (canSell && mode === "fixed" && bar.high >= pattern.target) {
      exitPrice = pattern.target;
      outcome = "target";
      exitIndex = i;
    } else if (canSell && i - entryIndex >= horizon) {
      exitPrice = bar.open;
      outcome = "expired";
      exitIndex = i;
    }
    dailyReturns.push({ date: bar.date, gross: bar.close / entry - 1 });
    if (outcome !== "open") break;
    if (bar.low <= stop) pendingExit = true;
    // Today's high/ATR can only tighten TOMORROW's stop.
    if (mode === "trend") {
      peak = Math.max(peak, bar.high);
      const atr = wilderAtr(bars.slice(Math.max(0, i - 100), i + 1));
      if (atr != null) stop = Math.max(stop, peak - 3 * atr);
    }
  }
  return {
    pattern: { ...pattern, entry },
    outcome,
    signalDate: bars[signal].date,
    entryDate: first.date,
    exitDate: bars[exitIndex].date,
    holdDays: exitIndex - entryIndex,
    returnPct: exitPrice / entry - 1,
    exitPrice,
    riskPct,
    exitMode: mode,
    dailyReturns,
  };
}

export function backtestAdamEve(
  bars: Bar[],
  mode: ExitMode = "trend",
  code = "",
): PastTrade[] {
  return confirmedSignals(bars, "adam-eve")
    .map((p) => settleTrade(bars, p, mode, code))
    .reverse();
}

/**
 * Reverse of Adam & Eve: a rounded Eve base first, then a sharp V that lifts through the neckline.
 * The tradable event is the V, not the first bounce off a panic low.
 */
function collectEveAdam(bars: Bar[], archive: boolean): Pattern[] {
  if (bars.length < 90) return [];
  const last = bars.length - 1;
  const pivots = swingLows(bars, 3).filter(
    (index) => index > 40 && index < last - 2,
  );
  const found: Pattern[] = [];
  let best: Pattern | null = null;

  for (let left = 0; left < pivots.length; left += 1) {
    for (let right = left + 1; right < pivots.length; right += 1) {
      const eveIndex = pivots[left];
      const adamIndex = pivots[right];
      const span = adamIndex - eveIndex;
      if (span < 10 || span > 55) continue;
      if (!archive && last - adamIndex > 36) continue;

      const eveLow = bars[eveIndex].low;
      const adamLow = bars[adamIndex].low;
      const midLow = (adamLow + eveLow) / 2;
      const lowGap = Math.abs(adamLow - eveLow) / midLow;
      if (lowGap > 0.06) continue;
      if (adamLow < eveLow * 0.975) continue;

      let neckIndex = eveIndex + 1;
      let neckline = -Infinity;
      for (let i = eveIndex + 1; i < adamIndex; i += 1) {
        if (bars[i].high > neckline) {
          neckline = bars[i].high;
          neckIndex = i;
        }
      }
      if (!Number.isFinite(neckline)) continue;
      const higherLow = Math.max(adamLow, eveLow);
      const rebound = (neckline - higherLow) / higherLow;
      if (rebound < 0.05 || rebound > 0.32) continue;

      const zoneStart = Math.max(0, eveIndex - 36);
      let zoneLow = Infinity;
      let zoneHigh = -Infinity;
      for (let i = zoneStart; i < eveIndex - 2; i += 1) {
        if (bars[i].low < zoneLow) zoneLow = bars[i].low;
        if (bars[i].high > zoneHigh) zoneHigh = bars[i].high;
      }
      if (!Number.isFinite(zoneLow) || eveLow > zoneLow * 1.035) continue;
      const zoneDepth = zoneHigh > 0 ? (zoneHigh - eveLow) / eveLow : 0;
      if (zoneDepth < 0.045 || zoneDepth > 0.26) continue;

      const highStart = Math.max(0, eveIndex - 90);
      let priorHigh = -Infinity;
      for (let i = highStart; i < zoneStart; i += 1) {
        if (bars[i].high > priorHigh) priorHigh = bars[i].high;
      }
      if (priorHigh <= 0) continue;
      const priorDrop = (priorHigh - eveLow) / priorHigh;
      if (priorDrop < 0.1) continue;

      const eveBasin = basin(
        bars,
        eveIndex,
        0.034,
        Math.max(0, eveIndex - 18),
        Math.max(eveIndex, neckIndex - 1),
      );
      const adamBasin = basin(
        bars,
        adamIndex,
        0.02,
        neckIndex,
        Math.min(last - 1, adamIndex + 8),
      );
      if (eveBasin.width < 8 || eveBasin.width > 28) continue;
      if (adamBasin.width < 1 || adamBasin.width > 7) continue;
      if (eveBasin.width < adamBasin.width + 4) continue;

      const neighbors = [
        adamIndex - 2,
        adamIndex - 1,
        adamIndex + 1,
        adamIndex + 2,
      ]
        .filter((index) => index >= 0 && index < bars.length)
        .map((index) => bars[index].low);
      const neighborAvg =
        neighbors.reduce((sum, value) => sum + value, 0) / neighbors.length;
      const spike = (neighborAvg - adamLow) / adamLow;
      if (spike < 0.01) continue;

      const eveLows = bars
        .slice(eveBasin.left, eveBasin.right + 1)
        .map((bar) => bar.low)
        .sort((x, y) => x - y);
      const eveMedian = eveLows[Math.floor(eveLows.length / 2)];
      const eveSpike = (eveMedian - eveLow) / eveLow;
      if (eveSpike > 0.032) continue;

      const floor = Math.min(adamLow, eveLow);
      const breakoutEnd = Math.min(bars.length, adamIndex + 15);
      let breakoutIndex: number | null = null;
      let killed = false;
      for (let i = adamIndex + 1; i < breakoutEnd; i += 1) {
        if (bars[i].close < floor * 0.972) {
          killed = true;
          break;
        }
        if (bars[i].close > neckline) {
          breakoutIndex = i;
          break;
        }
      }
      if (killed) continue;

      const lastClose = bars[last].close;
      const recent = last - adamIndex <= 36;
      let stage: Stage = "forming";
      let retestIndex: number | null = null;

      if (breakoutIndex == null) {
        if (!(archive && !recent)) {
          const distance = (neckline - lastClose) / neckline;
          if (distance < 0 || distance > 0.08) continue;
          if (lastClose < adamLow * 1.02) continue;
          if (last - adamIndex < 2 || last - adamIndex > 14) continue;
        }
        stage = "forming";
      } else if (archive) {
        const retestEnd = Math.min(last, breakoutIndex + 12);
        for (let i = breakoutIndex + 1; i <= retestEnd; i += 1) {
          const holds =
            bars[i].low <= neckline * 1.015 &&
            bars[i].low >= floor * 1.005 &&
            bars[i].close >= neckline * 0.992;
          if (holds) retestIndex = i;
        }
        stage = retestIndex != null ? "retest" : "breakout";
      } else {
        for (let i = breakoutIndex + 1; i <= last; i += 1) {
          const holds =
            bars[i].low <= neckline * 1.015 &&
            bars[i].low >= floor * 1.005 &&
            bars[i].close >= neckline * 0.992;
          if (holds) retestIndex = i;
        }
        const extension = (lastClose - neckline) / neckline;
        const since = last - breakoutIndex;
        if (lastClose < neckline * 0.985) continue;
        if (extension > 0.12 || since > 16) stage = "extended";
        else if (retestIndex != null && lastClose >= neckline * 0.998)
          stage = "retest";
        else stage = "breakout";
      }

      const compareAt = breakoutIndex ?? last;
      const baseAvg = averageVolume(bars, compareAt);
      const burst = bars[compareAt].volume;
      const rvol = baseAvg > 0 ? burst / baseAvg : 1;
      const eveVol = averageVolume(bars, eveIndex);
      const adamVol = averageVolume(bars, adamIndex);

      const stop = floor * 0.99;
      const decision =
        breakoutIndex != null ? bars[breakoutIndex].close : neckline;
      const openRisk = decision - stop;
      const minTarget = decision + openRisk;
      const half = (priorHigh + floor) / 2;
      let target = Math.max(half, minTarget);
      if (priorHigh >= minTarget && target > priorHigh) target = priorHigh;
      if (!archive && breakoutIndex != null) {
        const left = target - lastClose;
        const riskNow = lastClose - stop;
        if (!(left > 0 && riskNow > 0 && left / riskNow >= 1))
          stage = "extended";
      }
      const entry = decision;
      const risk = entry - stop;
      const rewardRisk = risk > 0 ? (target - entry) / risk : 0;

      let score = 28;
      score += clamp((0.04 - lowGap) * 280, 0, 12);
      score += clamp((spike - 0.01) * 380, 0, 14);
      score += clamp((eveBasin.width - adamBasin.width - 3) * 1.1, 0, 12);
      score += priorDrop >= 0.16 && priorDrop <= 0.45 ? 8 : 3;
      score += rebound >= 0.08 && rebound <= 0.22 ? 8 : 3;
      score += STAGE_BIAS[stage];
      if (breakoutIndex != null && breakoutIndex - adamIndex <= 6) score += 8;
      else if (breakoutIndex != null && breakoutIndex - adamIndex <= 10)
        score += 4;
      if (breakoutIndex != null && rvol >= 1.4) score += 6;
      if (eveVol > 0 && adamVol > eveVol) score += 4;
      if (stage === "forming" && !(archive && !recent)) {
        const distance = (neckline - lastClose) / neckline;
        score += clamp(6 - distance * 70, 0, 6);
      }
      if (!archive) {
        if (stage === "extended") score -= 6;
        if (rewardRisk < 0.6 && stage !== "forming") score -= 8;
      }
      score = Math.round(clamp(score, 1, 99));

      const atr = wilderAtr(bars) ?? lastClose * 0.03;
      const ma = sma(bars, 20) ?? lastClose;
      const ma60 = sma(bars, 60) ?? ma;
      const recentAvg = averageVolume(bars, last) || 1;
      const pattern: Pattern = {
        score,
        stage,
        adamIndex,
        eveIndex,
        neckIndex,
        adamLow,
        eveLow,
        neckline,
        breakoutIndex,
        retestIndex,
        adamWidth: adamBasin.width,
        eveWidth: eveBasin.width,
        priorDrop,
        rebound,
        lowGap,
        spike,
        entry,
        stop,
        target,
        rewardRisk,
        rvol,
        atr,
        atrPct: atr / lastClose,
        ma,
        ma60,
        atrMultipleFromMa: (lastClose - ma) / atr,
        gainFromMaPct: (lastClose - ma) / ma,
        volVsAvg: bars[last].volume / recentAvg - 1,
      };

      if (archive) found.push(pattern);
      else if (!best || pattern.score > best.score) best = pattern;
    }
  }

  return archive ? found : best ? [best] : [];
}

export function detectEveAdam(bars: Bar[]): Pattern | null {
  return collectEveAdam(bars, false)[0] ?? null;
}

export function backtestEveAdam(
  bars: Bar[],
  mode: ExitMode = "trend",
  code = "",
): PastTrade[] {
  return confirmedSignals(bars, "eve-adam")
    .map((p) => settleTrade(bars, p, mode, code))
    .reverse();
}

export function clipPattern(bars: Bar[], pattern: Pattern | null, tail = 140) {
  if (!pattern) {
    const start = Math.max(0, bars.length - tail);
    return { bars: bars.slice(start), pattern: null as Pattern | null };
  }
  const first = Math.min(pattern.adamIndex, pattern.eveIndex);
  const second = Math.max(pattern.adamIndex, pattern.eveIndex);
  const endIndex = pattern.breakoutIndex ?? second;
  const start = Math.max(0, first - 18);
  const end = Math.min(bars.length, endIndex + 24);
  const view = bars.slice(start, end);
  const shift = (index: number | null) =>
    index == null ? null : index - start;
  return {
    bars: view,
    pattern: {
      ...pattern,
      adamIndex: pattern.adamIndex - start,
      eveIndex: pattern.eveIndex - start,
      neckIndex: pattern.neckIndex - start,
      breakoutIndex: shift(pattern.breakoutIndex),
      retestIndex: shift(pattern.retestIndex),
    },
  };
}

export type MarketMetrics = {
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
};

export function marketMetrics(bars: Bar[]): MarketMetrics | null {
  if (bars.length < 22) return null;
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const atr = wilderAtr(bars) ?? last.close * 0.03;
  const ma = sma(bars, 20) ?? last.close;
  const ma60 = sma(bars, 60) ?? ma;
  const recentAvg = averageVolume(bars, bars.length - 1) || 1;
  const burstAvg = averageVolume(bars, bars.length - 1, 20) || 1;
  return {
    price: last.close,
    changePct: prev.close ? (last.close - prev.close) / prev.close : 0,
    atr,
    atrPct: atr / last.close,
    ma,
    ma60,
    atrMultipleFromMa: (last.close - ma) / atr,
    gainFromMaPct: (last.close - ma) / ma,
    volVsAvg: last.volume / recentAvg - 1,
    rvol: last.volume / burstAvg,
  };
}

export function boardOf(code: string): "main" | "chinext" | "star" | "other" {
  if (code.startsWith("688") || code.startsWith("689")) return "star";
  if (code.startsWith("300") || code.startsWith("301")) return "chinext";
  if (code.startsWith("60") || code.startsWith("00")) return "main";
  return "other";
}

export const STAGE_LABEL: Record<Stage, string> = {
  forming: "夏娃构筑",
  breakout: "颈线突破",
  retest: "回踩确认",
  extended: "延伸偏远",
};
