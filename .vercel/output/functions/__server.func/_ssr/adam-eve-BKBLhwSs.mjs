//#region node_modules/.nitro/vite/services/ssr/assets/adam-eve-BKBLhwSs.js
var STAGE_BIAS = {
	retest: 10,
	breakout: 8,
	forming: 5,
	extended: -4
};
function basin(bars, index, pct, minLeft, maxRight) {
	const cap = bars[index].low * (1 + pct);
	let left = index;
	let right = index;
	while (left > minLeft && bars[left - 1].low <= cap) left -= 1;
	while (right < maxRight && bars[right + 1].low <= cap) right += 1;
	return {
		left,
		right,
		width: right - left + 1
	};
}
function swingLows(bars, width) {
	const found = [];
	for (let i = width; i < bars.length - width; i += 1) {
		let pivot = true;
		for (let k = i - width; k <= i + width; k += 1) if (k !== i && bars[k].low < bars[i].low) {
			pivot = false;
			break;
		}
		if (pivot) found.push(i);
	}
	const merged = [];
	for (const index of found) {
		const last = merged[merged.length - 1];
		if (last != null && index - last < 5) {
			if (bars[index].low < bars[last].low) merged[merged.length - 1] = index;
		} else merged.push(index);
	}
	return merged;
}
function averageVolume(bars, end, lookback = 20) {
	const start = Math.max(0, end - lookback);
	let sum = 0;
	let count = 0;
	for (let i = start; i < end; i += 1) {
		sum += bars[i].volume;
		count += 1;
	}
	return count ? sum / count : 0;
}
function wilderAtr(bars, period = 14) {
	if (bars.length < period + 1) return null;
	const tr = [];
	for (let i = 0; i < bars.length; i += 1) {
		if (i === 0) {
			tr.push(bars[i].high - bars[i].low);
			continue;
		}
		const prev = bars[i - 1].close;
		tr.push(Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - prev), Math.abs(bars[i].low - prev)));
	}
	let value = 0;
	for (let i = 0; i < period; i += 1) value += tr[i];
	value /= period;
	for (let i = period; i < tr.length; i += 1) value = (value * (period - 1) + tr[i]) / period;
	return value;
}
function sma(bars, period) {
	if (bars.length < period) return null;
	let sum = 0;
	for (let i = bars.length - period; i < bars.length; i += 1) sum += bars[i].close;
	return sum / period;
}
function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}
var HORIZON = 30;
var OUTCOME_LABEL = {
	target: "先到目标",
	stop: "先到止损",
	expired: "到期未触及",
	open: "进行中",
	missed: "未突破"
};
/**
* Adam & Eve double bottom.
* Adam is the first, narrow V. Eve is the later, wider U.
* Neckline is the peak between them. Entry is a close through that line.
* `archive` keeps older setups instead of only the one still in play.
*/
function collectPatterns(bars, archive) {
	if (bars.length < 70) return [];
	const last = bars.length - 1;
	const pivots = swingLows(bars, 3).filter((index) => index > 20 && index < last - 2);
	const found = [];
	let best = null;
	for (let a = 0; a < pivots.length; a += 1) for (let e = a + 1; e < pivots.length; e += 1) {
		const adamIndex = pivots[a];
		const eveIndex = pivots[e];
		const span = eveIndex - adamIndex;
		if (span < 8 || span > 70) continue;
		if (!archive && last - eveIndex > 40) continue;
		const adamLow = bars[adamIndex].low;
		const eveLow = bars[eveIndex].low;
		const midLow = (adamLow + eveLow) / 2;
		const lowGap = Math.abs(adamLow - eveLow) / midLow;
		if (lowGap > .055) continue;
		if (eveLow < adamLow * .975) continue;
		let neckIndex = adamIndex + 1;
		let neckline = -Infinity;
		for (let i = adamIndex + 1; i < eveIndex; i += 1) if (bars[i].high > neckline) {
			neckline = bars[i].high;
			neckIndex = i;
		}
		if (!Number.isFinite(neckline)) continue;
		const higherLow = Math.max(adamLow, eveLow);
		const rebound = (neckline - higherLow) / higherLow;
		if (rebound < .06 || rebound > .5) continue;
		const lookback = Math.max(0, adamIndex - 40);
		let priorHigh = -Infinity;
		for (let i = lookback; i < adamIndex - 2; i += 1) if (bars[i].high > priorHigh) priorHigh = bars[i].high;
		if (priorHigh <= 0) continue;
		const priorDrop = (priorHigh - adamLow) / priorHigh;
		if (priorDrop < .07) continue;
		const adamBasin = basin(bars, adamIndex, .025, Math.max(0, adamIndex - 14), Math.max(adamIndex, neckIndex - 1));
		const eveBasin = basin(bars, eveIndex, .032, neckIndex, Math.min(last - 1, eveIndex + 16));
		if (adamBasin.width > 9 || adamBasin.width < 1) continue;
		if (eveBasin.width < 6 || eveBasin.width > 26) continue;
		if (eveBasin.width < adamBasin.width + 3) continue;
		const neighbors = [
			adamIndex - 2,
			adamIndex - 1,
			adamIndex + 1,
			adamIndex + 2
		].filter((index) => index >= 0 && index < bars.length).map((index) => bars[index].low);
		const spike = (neighbors.reduce((sum, value) => sum + value, 0) / neighbors.length - adamLow) / adamLow;
		if (spike < .006) continue;
		const eveLows = bars.slice(eveBasin.left, eveBasin.right + 1).map((bar) => bar.low).sort((x, y) => x - y);
		if ((eveLows[Math.floor(eveLows.length / 2)] - eveLow) / eveLow > .04) continue;
		const floor = Math.min(adamLow, eveLow);
		const breakoutEnd = archive ? Math.min(bars.length, eveIndex + 36) : bars.length;
		let breakoutIndex = null;
		let killed = false;
		for (let i = eveIndex + 1; i < breakoutEnd; i += 1) {
			if (bars[i].close < floor * .972) {
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
		let stage = "forming";
		let retestIndex = null;
		if (breakoutIndex == null) {
			if (!(archive && !recent)) {
				const distance = (neckline - lastClose) / neckline;
				if (distance < 0 || distance > .09) continue;
				if (lastClose < eveLow * 1.015) continue;
				if (last - eveIndex < 3) continue;
			}
			stage = "forming";
		} else if (archive) {
			const retestEnd = Math.min(last, breakoutIndex + 12);
			for (let i = breakoutIndex + 1; i <= retestEnd; i += 1) if (bars[i].low <= neckline * 1.015 && bars[i].low >= floor * 1.005 && bars[i].close >= neckline * .992) retestIndex = i;
			stage = retestIndex != null ? "retest" : "breakout";
		} else {
			for (let i = breakoutIndex + 1; i <= last; i += 1) if (bars[i].low <= neckline * 1.015 && bars[i].low >= floor * 1.005 && bars[i].close >= neckline * .992) retestIndex = i;
			const extension = (lastClose - neckline) / neckline;
			const since = last - breakoutIndex;
			if (lastClose < neckline * .985) continue;
			if (extension > .11 || since > 16) stage = "extended";
			else if (retestIndex != null && lastClose >= neckline * .998) stage = "retest";
			else stage = "breakout";
		}
		const compareAt = breakoutIndex ?? last;
		const baseAvg = averageVolume(bars, compareAt);
		const burst = bars[compareAt].volume;
		const rvol = baseAvg > 0 ? burst / baseAvg : 1;
		const adamVol = averageVolume(bars, adamIndex);
		const stop = floor * .99;
		const entry = archive && breakoutIndex != null ? bars[breakoutIndex].close : stage === "forming" ? neckline : lastClose;
		const target = neckline + (neckline - floor);
		const risk = entry - stop;
		const rewardRisk = risk > 0 ? (target - entry) / risk : 0;
		let score = 28;
		score += clamp((.035 - lowGap) * 320, 0, 14);
		score += clamp((spike - .006) * 420, 0, 14);
		score += clamp((eveBasin.width - adamBasin.width - 2) * 1.15, 0, 12);
		score += priorDrop >= .12 && priorDrop <= .36 ? 8 : 3;
		score += rebound >= .1 && rebound <= .28 ? 8 : 3;
		score += STAGE_BIAS[stage];
		if (breakoutIndex != null && rvol >= 1.4) score += 8;
		else if (breakoutIndex != null && rvol >= 1.1) score += 3;
		if (adamVol > 0 && averageVolume(bars, eveIndex) < adamVol * .9) score += 4;
		if (stage === "forming" && !(archive && !recent)) {
			const distance = (neckline - lastClose) / neckline;
			score += clamp(6 - distance * 70, 0, 6);
		}
		if (!archive) {
			if (stage === "extended") score -= 6;
			if (rewardRisk < .6 && stage !== "forming") score -= 8;
			if ((stage === "breakout" || stage === "retest") && last - (breakoutIndex ?? last) <= 2) score += 3;
		}
		score = Math.round(clamp(score, 1, 99));
		const atr = wilderAtr(bars) ?? lastClose * .03;
		const ma = sma(bars, 20) ?? lastClose;
		const ma60 = sma(bars, 60) ?? ma;
		const recentAvg = averageVolume(bars, last) || 1;
		const pattern = {
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
			volVsAvg: bars[last].volume / recentAvg - 1
		};
		if (archive) found.push(pattern);
		else if (!best || pattern.score > best.score) best = pattern;
	}
	return archive ? found : best ? [best] : [];
}
function detectAdamEve(bars) {
	return collectPatterns(bars, false)[0] ?? null;
}
function settleTrade(bars, pattern) {
	const last = bars.length - 1;
	const signal = pattern.breakoutIndex;
	if (signal == null) {
		const pivot = Math.max(pattern.adamIndex, pattern.eveIndex);
		return {
			pattern,
			outcome: last - pivot <= 40 ? "open" : "missed",
			signalDate: bars[pivot].date,
			exitDate: bars[pivot].date,
			holdDays: 0,
			returnPct: 0,
			exitPrice: bars[pivot].low
		};
	}
	const entry = bars[signal].close;
	const horizon = Math.min(last, signal + HORIZON);
	let outcome = last < signal + HORIZON ? "open" : "expired";
	let exitIndex = horizon;
	let exitPrice = bars[horizon].close;
	for (let i = signal + 1; i <= horizon; i += 1) {
		const hitStop = bars[i].low <= pattern.stop;
		const hitTarget = bars[i].high >= pattern.target;
		if (!hitStop && !hitTarget) continue;
		if (hitStop) {
			outcome = "stop";
			exitPrice = pattern.stop;
		} else {
			outcome = "target";
			exitPrice = pattern.target;
		}
		exitIndex = i;
		break;
	}
	return {
		pattern: {
			...pattern,
			entry
		},
		outcome,
		signalDate: bars[signal].date,
		exitDate: bars[exitIndex].date,
		holdDays: exitIndex - signal,
		returnPct: entry > 0 ? exitPrice / entry - 1 : 0,
		exitPrice
	};
}
function backtestAdamEve(bars) {
	const found = collectPatterns(bars, true).filter((pattern) => pattern.score >= (pattern.breakoutIndex == null ? 58 : 48)).sort((a, b) => a.eveIndex - b.eveIndex);
	const kept = [];
	for (const pattern of found) {
		const prev = kept[kept.length - 1];
		if (prev && pattern.adamIndex <= prev.eveIndex + 10) {
			if (pattern.score > prev.score) kept[kept.length - 1] = pattern;
			continue;
		}
		kept.push(pattern);
	}
	return kept.map((pattern) => settleTrade(bars, pattern)).reverse();
}
/**
* Reverse of Adam & Eve: a rounded Eve base first, then a sharp V that lifts through the neckline.
* The tradable event is the V, not the first bounce off a panic low.
*/
function collectEveAdam(bars, archive) {
	if (bars.length < 90) return [];
	const last = bars.length - 1;
	const pivots = swingLows(bars, 3).filter((index) => index > 40 && index < last - 2);
	const found = [];
	let best = null;
	for (let left = 0; left < pivots.length; left += 1) for (let right = left + 1; right < pivots.length; right += 1) {
		const eveIndex = pivots[left];
		const adamIndex = pivots[right];
		const span = adamIndex - eveIndex;
		if (span < 10 || span > 55) continue;
		if (!archive && last - adamIndex > 36) continue;
		const eveLow = bars[eveIndex].low;
		const adamLow = bars[adamIndex].low;
		const midLow = (adamLow + eveLow) / 2;
		const lowGap = Math.abs(adamLow - eveLow) / midLow;
		if (lowGap > .06) continue;
		if (adamLow < eveLow * .975) continue;
		let neckIndex = eveIndex + 1;
		let neckline = -Infinity;
		for (let i = eveIndex + 1; i < adamIndex; i += 1) if (bars[i].high > neckline) {
			neckline = bars[i].high;
			neckIndex = i;
		}
		if (!Number.isFinite(neckline)) continue;
		const higherLow = Math.max(adamLow, eveLow);
		const rebound = (neckline - higherLow) / higherLow;
		if (rebound < .05 || rebound > .32) continue;
		const zoneStart = Math.max(0, eveIndex - 36);
		let zoneLow = Infinity;
		let zoneHigh = -Infinity;
		for (let i = zoneStart; i < eveIndex - 2; i += 1) {
			if (bars[i].low < zoneLow) zoneLow = bars[i].low;
			if (bars[i].high > zoneHigh) zoneHigh = bars[i].high;
		}
		if (!Number.isFinite(zoneLow) || eveLow > zoneLow * 1.035) continue;
		const zoneDepth = zoneHigh > 0 ? (zoneHigh - eveLow) / eveLow : 0;
		if (zoneDepth < .045 || zoneDepth > .26) continue;
		const highStart = Math.max(0, eveIndex - 90);
		let priorHigh = -Infinity;
		for (let i = highStart; i < zoneStart; i += 1) if (bars[i].high > priorHigh) priorHigh = bars[i].high;
		if (priorHigh <= 0) continue;
		const priorDrop = (priorHigh - eveLow) / priorHigh;
		if (priorDrop < .1) continue;
		const eveBasin = basin(bars, eveIndex, .034, Math.max(0, eveIndex - 18), Math.max(eveIndex, neckIndex - 1));
		const adamBasin = basin(bars, adamIndex, .02, neckIndex, Math.min(last - 1, adamIndex + 8));
		if (eveBasin.width < 8 || eveBasin.width > 28) continue;
		if (adamBasin.width < 1 || adamBasin.width > 7) continue;
		if (eveBasin.width < adamBasin.width + 4) continue;
		const neighbors = [
			adamIndex - 2,
			adamIndex - 1,
			adamIndex + 1,
			adamIndex + 2
		].filter((index) => index >= 0 && index < bars.length).map((index) => bars[index].low);
		const spike = (neighbors.reduce((sum, value) => sum + value, 0) / neighbors.length - adamLow) / adamLow;
		if (spike < .01) continue;
		const eveLows = bars.slice(eveBasin.left, eveBasin.right + 1).map((bar) => bar.low).sort((x, y) => x - y);
		if ((eveLows[Math.floor(eveLows.length / 2)] - eveLow) / eveLow > .032) continue;
		const floor = Math.min(adamLow, eveLow);
		const breakoutEnd = Math.min(bars.length, adamIndex + 15);
		let breakoutIndex = null;
		let killed = false;
		for (let i = adamIndex + 1; i < breakoutEnd; i += 1) {
			if (bars[i].close < floor * .972) {
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
		let stage = "forming";
		let retestIndex = null;
		if (breakoutIndex == null) {
			if (!(archive && !recent)) {
				const distance = (neckline - lastClose) / neckline;
				if (distance < 0 || distance > .08) continue;
				if (lastClose < adamLow * 1.02) continue;
				if (last - adamIndex < 2 || last - adamIndex > 14) continue;
			}
			stage = "forming";
		} else if (archive) {
			const retestEnd = Math.min(last, breakoutIndex + 12);
			for (let i = breakoutIndex + 1; i <= retestEnd; i += 1) if (bars[i].low <= neckline * 1.015 && bars[i].low >= floor * 1.005 && bars[i].close >= neckline * .992) retestIndex = i;
			stage = retestIndex != null ? "retest" : "breakout";
		} else {
			for (let i = breakoutIndex + 1; i <= last; i += 1) if (bars[i].low <= neckline * 1.015 && bars[i].low >= floor * 1.005 && bars[i].close >= neckline * .992) retestIndex = i;
			const extension = (lastClose - neckline) / neckline;
			const since = last - breakoutIndex;
			if (lastClose < neckline * .985) continue;
			if (extension > .12 || since > 16) stage = "extended";
			else if (retestIndex != null && lastClose >= neckline * .998) stage = "retest";
			else stage = "breakout";
		}
		const compareAt = breakoutIndex ?? last;
		const baseAvg = averageVolume(bars, compareAt);
		const burst = bars[compareAt].volume;
		const rvol = baseAvg > 0 ? burst / baseAvg : 1;
		const eveVol = averageVolume(bars, eveIndex);
		const adamVol = averageVolume(bars, adamIndex);
		const stop = floor * .99;
		const entry = archive && breakoutIndex != null ? bars[breakoutIndex].close : stage === "forming" ? neckline : lastClose;
		const target = neckline + (neckline - floor);
		const risk = entry - stop;
		const rewardRisk = risk > 0 ? (target - entry) / risk : 0;
		let score = 28;
		score += clamp((.04 - lowGap) * 280, 0, 12);
		score += clamp((spike - .01) * 380, 0, 14);
		score += clamp((eveBasin.width - adamBasin.width - 3) * 1.1, 0, 12);
		score += priorDrop >= .16 && priorDrop <= .45 ? 8 : 3;
		score += rebound >= .08 && rebound <= .22 ? 8 : 3;
		score += STAGE_BIAS[stage];
		if (breakoutIndex != null && breakoutIndex - adamIndex <= 6) score += 8;
		else if (breakoutIndex != null && breakoutIndex - adamIndex <= 10) score += 4;
		if (breakoutIndex != null && rvol >= 1.4) score += 6;
		if (eveVol > 0 && adamVol > eveVol) score += 4;
		if (stage === "forming" && !(archive && !recent)) {
			const distance = (neckline - lastClose) / neckline;
			score += clamp(6 - distance * 70, 0, 6);
		}
		if (!archive) {
			if (stage === "extended") score -= 6;
			if (rewardRisk < .6 && stage !== "forming") score -= 8;
		}
		score = Math.round(clamp(score, 1, 99));
		const atr = wilderAtr(bars) ?? lastClose * .03;
		const ma = sma(bars, 20) ?? lastClose;
		const ma60 = sma(bars, 60) ?? ma;
		const recentAvg = averageVolume(bars, last) || 1;
		const pattern = {
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
			volVsAvg: bars[last].volume / recentAvg - 1
		};
		if (archive) found.push(pattern);
		else if (!best || pattern.score > best.score) best = pattern;
	}
	return archive ? found : best ? [best] : [];
}
function detectEveAdam(bars) {
	return collectEveAdam(bars, false)[0] ?? null;
}
function backtestEveAdam(bars) {
	const found = collectEveAdam(bars, true).filter((pattern) => pattern.score >= (pattern.breakoutIndex == null ? 58 : 48)).sort((a, b) => a.adamIndex - b.adamIndex);
	const kept = [];
	for (const pattern of found) {
		const prev = kept[kept.length - 1];
		const prevEnd = prev ? Math.max(prev.adamIndex, prev.eveIndex) : -1;
		if (prev && pattern.eveIndex <= prevEnd + 10) {
			if (pattern.score > prev.score) kept[kept.length - 1] = pattern;
			continue;
		}
		kept.push(pattern);
	}
	return kept.map((pattern) => settleTrade(bars, pattern)).reverse();
}
function clipPattern(bars, pattern, tail = 140) {
	if (!pattern) {
		const start = Math.max(0, bars.length - tail);
		return {
			bars: bars.slice(start),
			pattern: null
		};
	}
	const first = Math.min(pattern.adamIndex, pattern.eveIndex);
	const second = Math.max(pattern.adamIndex, pattern.eveIndex);
	const endIndex = pattern.breakoutIndex ?? second;
	const start = Math.max(0, first - 18);
	const end = Math.min(bars.length, endIndex + 24);
	const view = bars.slice(start, end);
	const shift = (index) => index == null ? null : index - start;
	return {
		bars: view,
		pattern: {
			...pattern,
			adamIndex: pattern.adamIndex - start,
			eveIndex: pattern.eveIndex - start,
			neckIndex: pattern.neckIndex - start,
			breakoutIndex: shift(pattern.breakoutIndex),
			retestIndex: shift(pattern.retestIndex)
		}
	};
}
function marketMetrics(bars) {
	if (bars.length < 22) return null;
	const last = bars[bars.length - 1];
	const prev = bars[bars.length - 2];
	const atr = wilderAtr(bars) ?? last.close * .03;
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
		rvol: last.volume / burstAvg
	};
}
function boardOf(code) {
	if (code.startsWith("688") || code.startsWith("689")) return "star";
	if (code.startsWith("300") || code.startsWith("301")) return "chinext";
	if (code.startsWith("60") || code.startsWith("00")) return "main";
	return "other";
}
var STAGE_LABEL = {
	forming: "夏娃构筑",
	breakout: "颈线突破",
	retest: "回踩确认",
	extended: "延伸偏远"
};
//#endregion
export { boardOf as a, detectEveAdam as c, backtestEveAdam as i, marketMetrics as l, STAGE_LABEL as n, clipPattern as o, backtestAdamEve as r, detectAdamEve as s, OUTCOME_LABEL as t };
