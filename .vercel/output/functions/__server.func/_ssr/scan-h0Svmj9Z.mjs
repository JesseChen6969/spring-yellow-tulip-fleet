import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
import { a as boardOf, c as detectEveAdam, i as backtestEveAdam, l as marketMetrics, r as backtestAdamEve, s as detectAdamEve } from "./adam-eve-BKBLhwSs.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/scan-h0Svmj9Z.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var SLOT_WEIGHT = .125;
function blockedName(name) {
	const text = name.replace(/\s+/g, "").toUpperCase();
	if (text.includes("ST")) return true;
	if (text.includes("退")) return true;
	if (text.startsWith("N") || text.startsWith("C")) return true;
	return false;
}
function limitPct(code) {
	const board = boardOf(code);
	if (board === "chinext" || board === "star") return .2;
	return .1;
}
function averageAmount(bars, end, lookback = 20) {
	const start = Math.max(0, end - lookback);
	let sum = 0;
	let count = 0;
	for (let index = start; index < end; index += 1) {
		sum += bars[index].amount;
		count += 1;
	}
	return count ? sum / count : 0;
}
function isOneWordLimitUp(prev, bar, limit) {
	if (!(prev.close > 0)) return false;
	const ceiling = prev.close * (1 + limit);
	return bar.open >= ceiling * .997 && bar.low >= ceiling * .997;
}
function netReturn(gross) {
	if (!Number.isFinite(gross)) return 0;
	return (1 + gross) * .99825 / 1.00125 - 1;
}
function liveGate(code, name, bars, marketDate) {
	if (blockedName(name)) return "name";
	if (bars.length < 60) return "ipo";
	const last = bars[bars.length - 1];
	if (!last || last.volume <= 0) return "halt";
	if (marketDate && last.date < marketDate) return "halt";
	if (averageAmount(bars, bars.length, 20) < 8e7) return "amount";
	const prev = bars[bars.length - 2];
	if (prev && isOneWordLimitUp(prev, last, limitPct(code))) return "limit";
	return null;
}
function entryGate(code, bars, index, young) {
	if (young && index < 60) return "ipo";
	if (index < 21) return "amount";
	const bar = bars[index];
	const prev = bars[index - 1];
	if (!bar || bar.volume <= 0) return "halt";
	if (isOneWordLimitUp(prev, bar, limitPct(code))) return "limit";
	if (averageAmount(bars, index, 20) < 8e7) return "amount";
	return null;
}
var GATE_LABEL = {
	name: "ST、*ST 或退市整理，不进股票池。",
	ipo: "上市不足 60 个交易日。",
	halt: "停牌或当日没有成交。",
	limit: "一字涨停，按买不进处理。",
	amount: "近 20 日日均成交额低于 8000 万。"
};
function markIndex(bars) {
	const map = /* @__PURE__ */ new Map();
	for (let index = 24; index < bars.length; index += 1) {
		let sum = 0;
		for (let cursor = index - 19; cursor <= index; cursor += 1) sum += bars[cursor].close;
		const ma = sum / 20;
		let prev = 0;
		for (let cursor = index - 24; cursor <= index - 5; cursor += 1) prev += bars[cursor].close;
		const maPrev = prev / 20;
		const gap = ma > 0 ? bars[index].close / ma - 1 : 0;
		map.set(bars[index].date, {
			riskOff: gap <= -.03 && ma < maPrev,
			gap
		});
	}
	return map;
}
function describeRegime(shanghai, csi) {
	const sh = markIndex(shanghai);
	const cs = markIndex(csi);
	const byDate = {};
	let riskOffDays = 0;
	for (const bar of csi) {
		const flag = (sh.get(bar.date)?.riskOff ?? false) || (cs.get(bar.date)?.riskOff ?? false);
		byDate[bar.date] = flag;
		if (flag) riskOffDays += 1;
	}
	const asOf = csi[csi.length - 1]?.date ?? shanghai[shanghai.length - 1]?.date ?? "";
	const shNow = sh.get(asOf);
	const csNow = cs.get(asOf);
	const parts = [];
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
			detail: riskOff ? `${parts.join("；")}。只保留评分不低于 72 的信号。` : "上证和沪深300都没有处在20日线下方的单边下跌。"
		}
	};
}
var SINA = "https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData";
var TENCENT = "https://proxy.finance.qq.com/ifzqgtimg/appstock/app/newfqkline/get";
var SINA_KLINE = "https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData";
var klineCache = /* @__PURE__ */ new Map();
var KLINE_TTL = 48e4;
function symbolOf(code) {
	if (code.startsWith("6") || code.startsWith("9")) return `sh${code}`;
	if (code.startsWith("4") || code.startsWith("8")) return `bj${code}`;
	return `sz${code}`;
}
function cleanName(name) {
	return name.replace(/\s+/g, "").trim();
}
async function fetchJson(url, referer) {
	let lastError;
	for (let attempt = 0; attempt < 3; attempt += 1) try {
		const response = await fetch(url, {
			headers: {
				"User-Agent": "Mozilla/5.0",
				Referer: referer,
				Accept: "application/json,text/plain,*/*"
			},
			signal: AbortSignal.timeout(12e3)
		});
		if (!response.ok) throw new Error(`行情响应 ${response.status}`);
		return await response.json();
	} catch (error) {
		lastError = error;
		await new Promise((resolve) => setTimeout(resolve, 280 * (attempt + 1)));
	}
	throw lastError instanceof Error ? lastError : /* @__PURE__ */ new Error("行情源没有回应");
}
async function loadUniverse(node, size, page = 1) {
	const rows = await fetchJson(`${SINA}?page=${page}&num=${size}&sort=amount&asc=0&node=${node}`, "https://finance.sina.com.cn");
	if (!Array.isArray(rows)) throw new Error("股票列表格式异常");
	return rows;
}
function amountYuan(close, volume, quoted, unit) {
	if (quoted != null && Number.isFinite(quoted) && quoted > 0) return quoted * 1e4;
	return (unit === "lot" ? volume * 100 : volume) * close;
}
function parseTencentRows(rows) {
	if (!rows?.length) return [];
	return rows.map((row) => {
		const close = Number(row[2]);
		const volume = Number(row[5]);
		return {
			date: String(row[0]),
			open: Number(row[1]),
			close,
			high: Number(row[3]),
			low: Number(row[4]),
			volume,
			amount: amountYuan(close, volume, Number(row[8]), "lot")
		};
	}).filter((bar) => bar.date && bar.close > 0 && bar.high > 0 && bar.low > 0);
}
function parseSinaRows(rows) {
	if (!Array.isArray(rows)) return [];
	return rows.map((row) => {
		const close = Number(row.close);
		const volume = Number(row.volume);
		return {
			date: String(row.day),
			open: Number(row.open),
			high: Number(row.high),
			low: Number(row.low),
			close,
			volume,
			amount: amountYuan(close, volume, void 0, "share")
		};
	}).filter((bar) => bar.date && bar.close > 0 && bar.high > 0 && bar.low > 0);
}
async function loadSymbol(symbol, count) {
	const pack = (await fetchJson(`${TENCENT}?param=${symbol},day,,,${count},qfq`, "https://gu.qq.com/")).data?.[symbol];
	return parseTencentRows(pack?.qfqday?.length ? pack.qfqday : pack?.day);
}
async function loadBars(code, count = 170) {
	const cacheKey = `${code}:${count}`;
	const cached = klineCache.get(cacheKey);
	if (cached && Date.now() - cached.at < KLINE_TTL) return cached;
	const symbol = symbolOf(code);
	let bars = [];
	let name = code;
	try {
		const pack = (await fetchJson(`${TENCENT}?param=${symbol},day,,,${count},qfq`, "https://gu.qq.com/")).data?.[symbol];
		bars = parseTencentRows(pack?.qfqday?.length ? pack.qfqday : pack?.day);
		const quoted = pack?.qt?.[symbol];
		if (quoted?.[1]) name = cleanName(quoted[1]);
	} catch {
		bars = [];
	}
	if (bars.length < 70) {
		const fallback = parseSinaRows(await fetchJson(`${SINA_KLINE}?symbol=${symbol}&scale=240&ma=no&datalen=${count}`, "https://finance.sina.com.cn"));
		if (fallback.length > bars.length) bars = fallback;
	}
	if (bars.length < 70) throw new Error(`${code} 日线不足`);
	const entry = {
		at: Date.now(),
		bars,
		name
	};
	klineCache.set(cacheKey, entry);
	return entry;
}
async function mapPool(items, limit, task) {
	const results = new Array(items.length);
	let cursor = 0;
	async function worker() {
		while (cursor < items.length) {
			const index = cursor;
			cursor += 1;
			results[index] = await task(items[index]);
		}
	}
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
	return results;
}
function mean(values) {
	if (!values.length) return 0;
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function sampleCurve(curve, max = 90) {
	if (curve.length <= max) return curve;
	const step = Math.ceil(curve.length / max);
	const sampled = [];
	for (let index = 0; index < curve.length; index += step) sampled.push(curve[index]);
	const last = curve[curve.length - 1];
	if (sampled[sampled.length - 1]?.date !== last.date) sampled.push(last);
	return sampled;
}
function simulateBook(trades, regime, calendar) {
	const byEntry = /* @__PURE__ */ new Map();
	for (const trade of trades) {
		const list = byEntry.get(trade.signalDate) ?? [];
		list.push(trade);
		byEntry.set(trade.signalDate, list);
	}
	for (const list of byEntry.values()) list.sort((a, b) => b.score - a.score);
	let cash = 1;
	const open = [];
	const curve = [];
	const closed = [];
	const grosses = [];
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
		const cap = riskOff ? 3 : 8;
		let opened = 0;
		for (const trade of due) {
			if (riskOff && (trade.score < 76 || opened >= 1)) {
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
			open.push({
				code: trade.code,
				cost: budget,
				exitDate: trade.exitDate,
				net: trade.net
			});
			grosses.push(trade.gross);
			taken += 1;
			opened += 1;
		}
		curve.push({
			date,
			equity: equityNow()
		});
	}
	for (const position of open) {
		cash += position.cost * (1 + position.net);
		closed.push(position.net);
	}
	if (calendar.length) curve.push({
		date: calendar[calendar.length - 1],
		equity: cash
	});
	let peak = 1;
	let maxDrawdown = 0;
	for (const point of curve) {
		peak = Math.max(peak, point.equity);
		maxDrawdown = Math.min(maxDrawdown, point.equity / peak - 1);
	}
	const totalReturn = cash - 1;
	const years = Math.max(1, calendar.length) / 242;
	const annualized = cash > 0 && years > .25 ? cash ** (1 / years) - 1 : totalReturn;
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
		curve: sampleCurve(curve.filter((point) => point.date))
	};
}
var UNIVERSE = 200;
var HISTORY = 640;
var cache = /* @__PURE__ */ new Map();
var TTL = 18e5;
function snapForward(date, calendar) {
	for (const day of calendar) if (day >= date) return day;
	return null;
}
async function liquidNames(limit) {
	const pageSize = 100;
	const pages = Math.ceil(limit / pageSize);
	const rows = [];
	for (let page = 1; page <= pages; page += 1) {
		const batch = await loadUniverse("hs_a", pageSize, page);
		rows.push(...batch);
		if (batch.length < pageSize) break;
	}
	const seen = /* @__PURE__ */ new Set();
	const unique = [];
	for (const row of rows) {
		if (!row.code || seen.has(row.code)) continue;
		const name = cleanName(String(row.name || ""));
		if (blockedName(name)) continue;
		if (boardOf(row.code) === "other") continue;
		seen.add(row.code);
		unique.push({
			code: row.code,
			name
		});
		if (unique.length >= limit) break;
	}
	return unique;
}
async function runStrategyBacktest(force = false, limit = UNIVERSE, book = "adam-eve") {
	const universe = limit || UNIVERSE;
	const key = `${book}:${universe}`;
	const cached = cache.get(key);
	if (universe === UNIVERSE && !force && cached && Date.now() - cached.at < TTL) return cached.report;
	const [names, shanghai, csi] = await Promise.all([
		liquidNames(universe),
		loadSymbol("sh000001", HISTORY),
		loadSymbol("sh000300", HISTORY)
	]);
	if (csi.length < 80) throw new Error("沪深300日线不足，回测停住了");
	const regime = describeRegime(shanghai, csi);
	const rejected = {
		name: 0,
		ipo: 0,
		halt: 0,
		limit: 0,
		amount: 0
	};
	let failed = 0;
	const books = await mapPool(names, 8, async (row) => {
		try {
			const loaded = await loadBars(row.code, HISTORY);
			if (blockedName(cleanName(loaded.name || row.name))) {
				rejected.name += 1;
				return [];
			}
			const young = loaded.bars.length < 500;
			const history = (book === "eve-adam" ? backtestEveAdam : backtestAdamEve)(loaded.bars);
			const trades = [];
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
					net: netReturn(trade.returnPct)
				});
			}
			return trades;
		} catch {
			failed += 1;
			return [];
		}
	});
	if (names.length > 0 && failed === names.length) throw new Error("日线源暂时没有回应");
	const trades = books.flat();
	const calendar = csi.map((bar) => bar.date);
	const aligned = trades.flatMap((trade) => {
		const signalDate = snapForward(trade.signalDate, calendar);
		let exitDate = snapForward(trade.exitDate, calendar);
		if (!signalDate || !exitDate) return [];
		if (exitDate <= signalDate) exitDate = calendar[calendar.indexOf(signalDate) + 1] ?? null;
		if (!exitDate) return [];
		return [{
			...trade,
			signalDate,
			exitDate
		}];
	});
	const report = {
		...simulateBook(aligned, regime.byDate, calendar),
		from: calendar[0] ?? "",
		to: calendar[calendar.length - 1] ?? "",
		universeSize: names.length,
		scanned: names.length - failed,
		failed,
		signals: aligned.length,
		rejected,
		riskOffDays: regime.riskOffDays,
		regime: regime.snapshot
	};
	if (universe === UNIVERSE) cache.set(key, {
		at: Date.now(),
		report
	});
	return report;
}
function present(code, name, amount, bars, pattern, full = false) {
	const metrics = marketMetrics(bars);
	const start = full ? 0 : pattern ? Math.max(0, pattern.adamIndex - 16) : Math.max(0, bars.length - 140);
	const view = bars.slice(start);
	const shift = (index) => index == null ? null : index - start;
	const shifted = pattern ? {
		...pattern,
		adamIndex: pattern.adamIndex - start,
		eveIndex: pattern.eveIndex - start,
		neckIndex: pattern.neckIndex - start,
		breakoutIndex: shift(pattern.breakoutIndex),
		retestIndex: shift(pattern.retestIndex)
	} : null;
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
		rvol: shifted?.rvol ?? metrics?.rvol ?? 0
	};
}
function engine(book) {
	return book === "eve-adam" ? {
		detect: detectEveAdam,
		history: backtestEveAdam
	} : {
		detect: detectAdamEve,
		history: backtestAdamEve
	};
}
function parseBook(value) {
	return value === "eve-adam" ? "eve-adam" : "adam-eve";
}
function parseInput(input) {
	const raw = input ?? {};
	const size = raw.size === 100 ? 100 : 60;
	const allowed = /* @__PURE__ */ new Set([
		"main",
		"chinext",
		"star"
	]);
	const boards = Array.isArray(raw.boards) ? raw.boards.filter((board) => allowed.has(board)) : [];
	const code = typeof raw.code === "string" ? raw.code.replace(/\D/g, "").slice(0, 6) : "";
	return {
		size,
		boards: boards.length ? boards : [
			"main",
			"chinext",
			"star"
		],
		code,
		book: parseBook(raw.book)
	};
}
async function marketContext() {
	try {
		const [shanghai, csi] = await Promise.all([loadSymbol("sh000001", 80), loadSymbol("sh000300", 80)]);
		const sessions = csi.length >= 30 ? csi : shanghai;
		if (sessions.length < 30) return null;
		const described = describeRegime(shanghai, csi);
		const marketDate = sessions.length >= 2 ? sessions[sessions.length - 2].date : sessions[sessions.length - 1].date;
		return {
			snapshot: described.snapshot,
			marketDate
		};
	} catch {
		return null;
	}
}
function passesPool(row, input, node, allBoards) {
	const name = cleanName(String(row.name || ""));
	if (!row.code || blockedName(name)) return false;
	const board = boardOf(row.code);
	if (board === "other") return false;
	if (!allBoards && node === "hs_a" && !input.boards.includes(board)) return false;
	return true;
}
async function runScan(input) {
	const context = await marketContext();
	const regime = context?.snapshot ?? null;
	const marketDate = context?.marketDate ?? "";
	if (input.code) {
		if (input.code.length !== 6) throw new Error("请输入 6 位 A 股代码");
		const picked = engine(input.book);
		const loaded = await loadBars(input.code, 640);
		const history = picked.history(loaded.bars);
		const pattern = picked.detect(loaded.bars);
		const focus = present(input.code, loaded.name, 0, loaded.bars, pattern, true);
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
			regime
		};
	}
	const allBoards = input.boards.length === 3;
	const only = input.boards.length === 1 ? input.boards[0] : null;
	const node = only === "star" ? "kcb" : only === "chinext" ? "cyb" : "hs_a";
	const selected = (await loadUniverse(node, input.size)).filter((row) => passesPool(row, input, node, allBoards));
	const picked = engine(input.book);
	const floor = regime?.riskOff ? 72 : 46;
	let failed = 0;
	let firstError = "";
	const scanned = await mapPool(selected, 8, async (row) => {
		try {
			const loaded = await loadBars(row.code);
			const name = cleanName(loaded.name || row.name);
			if (liveGate(row.code, name, loaded.bars, marketDate)) return null;
			const pattern = picked.detect(loaded.bars);
			if (!pattern || pattern.score < floor) return null;
			return present(row.code, name, Number(row.amount) || 0, loaded.bars, pattern);
		} catch (error) {
			failed += 1;
			if (!firstError) firstError = error instanceof Error ? error.message : "日线读取失败";
			return null;
		}
	});
	if (selected.length > 0 && failed === selected.length) throw new Error(firstError || "日线源暂时没有回应");
	const hits = scanned.filter((hit) => hit != null).sort((a, b) => (b.pattern?.score ?? 0) - (a.pattern?.score ?? 0));
	return {
		scanned: selected.length,
		failed,
		asOf: hits[0]?.bars[hits[0].bars.length - 1]?.date ?? marketDate,
		universe: (node === "kcb" ? "科创板成交额" : node === "cyb" ? "创业板成交额" : "沪深 A 成交额") + (input.book === "eve-adam" ? " · 逆向" : ""),
		hits,
		focus: hits[0] ?? null,
		regime
	};
}
var scanMarket_createServerFn_handler = createServerRpc({
	id: "62cbf39a6d3e6d97b84975bba2367255754b45550f618b483c54172b6962f428",
	name: "scanMarket",
	filename: "src/lib/market/scan.ts"
}, (opts) => scanMarket.__executeServer(opts));
var scanMarket = createServerFn({ method: "POST" }).validator((input) => parseInput(input)).handler(scanMarket_createServerFn_handler, async ({ data }) => runScan(data));
var backtestStrategy_createServerFn_handler = createServerRpc({
	id: "49cbd09ddad90bde0102a4ded8b074c0375c9d33e9ee3671430313832a610a35",
	name: "backtestStrategy",
	filename: "src/lib/market/scan.ts"
}, (opts) => backtestStrategy.__executeServer(opts));
var backtestStrategy = createServerFn({ method: "POST" }).validator((input) => {
	const raw = input ?? {};
	return {
		refresh: raw.refresh === true,
		book: parseBook(raw.book)
	};
}).handler(backtestStrategy_createServerFn_handler, async ({ data }) => runStrategyBacktest(data.refresh, void 0, data.book));
//#endregion
export { backtestStrategy_createServerFn_handler, scanMarket_createServerFn_handler };
