import { i as __toESM } from "../_runtime.mjs";
import { R as require_react, v as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as Search } from "../_libs/lucide-react.mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { n as STAGE_LABEL, o as clipPattern, t as OUTCOME_LABEL } from "./adam-eve-BKBLhwSs.mjs";
import { a as Line, c as Customized, d as Tooltip, i as XAxis, l as Cell, n as LineChart, o as ReferenceLine, r as YAxis, s as Bar, t as ComposedChart, u as ResponsiveContainer } from "../_libs/recharts+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DtPQihCL.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
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
var scanMarket = createServerFn({ method: "POST" }).validator((input) => parseInput(input)).handler(createSsrRpc("62cbf39a6d3e6d97b84975bba2367255754b45550f618b483c54172b6962f428"));
var backtestStrategy = createServerFn({ method: "POST" }).validator((input) => {
	const raw = input ?? {};
	return {
		refresh: raw.refresh === true,
		book: parseBook(raw.book)
	};
}).handler(createSsrRpc("49cbd09ddad90bde0102a4ded8b074c0375c9d33e9ee3671430313832a610a35"));
function signedPct(value, digits = 2) {
	if (!Number.isFinite(value)) return "—";
	const scaled = value * 100;
	return `${scaled > 0 ? "+" : ""}${scaled.toFixed(digits)}%`;
}
function price(value) {
	if (!Number.isFinite(value)) return "—";
	return value.toFixed(2);
}
function amountYi(yuan) {
	if (!yuan) return "—";
	const yi = yuan / 1e8;
	if (yi >= 100) return `${yi.toFixed(0)}亿`;
	return `${yi.toFixed(1)}亿`;
}
function multiple(value) {
	if (!Number.isFinite(value)) return "—";
	return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}
function ratio(value) {
	if (!Number.isFinite(value)) return "—";
	return value.toFixed(2);
}
var BOARD_LABEL = {
	main: "主板",
	chinext: "创业板",
	star: "科创板",
	other: "其他"
};
function withMovingAverages(bars) {
	return bars.map((bar, index) => {
		const mean = (period) => {
			if (index + 1 < period) return null;
			let sum = 0;
			for (let cursor = index - period + 1; cursor <= index; cursor += 1) sum += bars[cursor].close;
			return sum / period;
		};
		return {
			...bar,
			sma20: mean(20),
			sma60: mean(60)
		};
	});
}
function Tip({ active, payload }) {
	if (!active || !payload?.[0]) return null;
	const row = payload[0].payload;
	const up = row.close >= row.open;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg bg-surface px-3 py-2 text-xs shadow-ring",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-muted",
				children: row.date
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: up ? "text-up" : "text-down",
				children: [
					"开 ",
					price(row.open),
					"　收 ",
					price(row.close)
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-fg",
				children: [
					"高 ",
					price(row.high),
					"　低 ",
					price(row.low)
				]
			})
		]
	});
}
function CandleLayer(props) {
	const xAxis = props.xAxisMap && Object.values(props.xAxisMap)[0];
	const yAxis = props.yAxisMap && Object.values(props.yAxisMap)[0];
	if (!xAxis || !yAxis || !props.offset || props.rows.length === 0) return null;
	const offset = props.offset;
	const body = Math.max(2, offset.width / props.rows.length * .56);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", { children: props.rows.map((row, index) => {
		const cx = xAxis.scale(row.date);
		if (cx == null || Number.isNaN(cx)) return null;
		const color = row.close >= row.open ? "var(--color-up)" : "var(--color-down)";
		const yHigh = yAxis.scale(row.high);
		const yLow = yAxis.scale(row.low);
		const yOpen = yAxis.scale(row.open);
		const yClose = yAxis.scale(row.close);
		const top = Math.min(yOpen, yClose);
		const height = Math.max(1, Math.abs(yClose - yOpen));
		const mark = props.pattern?.adamIndex === index ? props.eveFirst ? "V" : "亚当" : props.pattern?.eveIndex === index ? "夏娃" : props.pattern?.breakoutIndex === index ? props.eveFirst ? "起来" : "突破" : props.pattern?.retestIndex === index ? "回踩" : null;
		const labelY = Math.max(offset.top + 12, yHigh - 16);
		const plate = mark ? mark.length * 12 + 8 : 0;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: cx,
				x2: cx,
				y1: yHigh,
				y2: yLow,
				stroke: color,
				strokeWidth: 1
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				x: cx - body / 2,
				y: top,
				width: body,
				height,
				fill: color
			}),
			mark ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				x: cx - plate / 2,
				y: labelY - 11,
				width: plate,
				height: 15,
				rx: 2,
				fill: "var(--color-bg)"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
				x: cx,
				y: labelY,
				textAnchor: "middle",
				fill: "var(--color-fg)",
				fontSize: 11,
				fontFamily: "var(--font-serif)",
				children: mark
			})] }) : null
		] }, row.date);
	}) });
}
function PriceChart({ bars, pattern, eveFirst = false }) {
	const rows = withMovingAverages(bars);
	const lows = rows.map((row) => row.low);
	const highs = rows.map((row) => row.high);
	let min = Math.min(...lows);
	let max = Math.max(...highs);
	if (pattern) {
		min = Math.min(min, pattern.stop);
		const cap = pattern.neckline * 1.2;
		max = Math.max(max, pattern.neckline, Math.min(pattern.target, cap));
	}
	const pad = (max - min) * .08 || max * .02;
	const domain = [min - pad, max + pad * 1.4];
	const targetInside = pattern != null && pattern.target <= pattern.neckline * 1.2;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-1",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "h-72 sm:h-96",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
					width: "100%",
					height: "100%",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ComposedChart, {
						data: rows,
						margin: {
							top: 12,
							right: 4,
							left: 0,
							bottom: 0
						},
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
								dataKey: "date",
								tickFormatter: (value) => value.slice(5),
								minTickGap: 28,
								tick: {
									fill: "var(--color-muted)",
									fontSize: 11
								},
								axisLine: { stroke: "var(--color-line)" },
								tickLine: false
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
								orientation: "right",
								domain,
								width: 52,
								tickFormatter: (value) => value.toFixed(2),
								tick: {
									fill: "var(--color-muted)",
									fontSize: 11
								},
								axisLine: false,
								tickLine: false
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {
								content: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tip, {}),
								cursor: { stroke: "var(--color-line)" }
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Line, {
								type: "monotone",
								dataKey: "sma20",
								stroke: "var(--color-fg)",
								strokeWidth: 1.25,
								dot: false,
								connectNulls: true,
								isAnimationActive: false
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Line, {
								type: "monotone",
								dataKey: "sma60",
								stroke: "var(--color-muted)",
								strokeWidth: 1,
								strokeDasharray: "4 4",
								dot: false,
								connectNulls: true,
								isAnimationActive: false
							}),
							pattern ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReferenceLine, {
								y: pattern.neckline,
								stroke: "var(--color-fg)",
								strokeDasharray: "4 3",
								label: {
									value: "颈线",
									fill: "var(--color-fg)",
									fontSize: 11,
									position: "insideTopLeft"
								}
							}) : null,
							pattern ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReferenceLine, {
								y: pattern.stop,
								stroke: "var(--color-down)",
								strokeDasharray: "2 3",
								label: {
									value: "止损",
									fill: "var(--color-down)",
									fontSize: 11,
									position: "insideBottomLeft"
								}
							}) : null,
							pattern && targetInside ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReferenceLine, {
								y: pattern.target,
								stroke: "var(--color-up)",
								strokeDasharray: "2 3",
								label: {
									value: "目标",
									fill: "var(--color-up)",
									fontSize: 11,
									position: "insideTopLeft"
								}
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Customized, { component: (layer) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CandleLayer, {
								...layer,
								rows,
								pattern,
								eveFirst
							}) })
						]
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "h-16",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
					width: "100%",
					height: "100%",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ComposedChart, {
						data: rows,
						margin: {
							top: 0,
							right: 4,
							left: 0,
							bottom: 0
						},
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
								dataKey: "date",
								hide: true
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
								orientation: "right",
								width: 52,
								hide: true,
								domain: [0, (dataMax) => dataMax * 3.2]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
								dataKey: "volume",
								isAnimationActive: false,
								barSize: 3,
								children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, { fill: row.close >= row.open ? "var(--color-up)" : "var(--color-down)" }, row.date))
							})
						]
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-muted",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "红涨绿跌" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "实线 20 日" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "虚线 60 日" }),
					pattern && !targetInside ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "目标高于可视区，见右侧计划" }) : null
				]
			})
		]
	});
}
function tone$1(value) {
	if (value > 5e-4) return "text-up";
	if (value < -5e-4) return "text-down";
	return "text-muted";
}
function StrategyPanel({ report, loading, error, onRetry, title = "策略收益", pending = "成交额前 200 只，近两年多，按同一套进场和出场规则复利。", rule }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "order-0 rounded-2xl bg-surface p-3 shadow-ring sm:p-4 lg:col-span-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-serif text-xl",
					children: title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted",
					children: report ? `${report.from} 至 ${report.to} · 成交额前 ${report.universeSize} 只 · 扣费后` : pending
				})] }), report ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onRetry,
					className: "h-10 rounded-lg px-3 text-sm text-muted",
					children: "重新计算"
				}) : null]
			}),
			loading && !report ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mt-4 h-28 animate-pulse rounded-xl bg-bg motion-reduce:animate-none" }) : null,
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-up",
				children: error
			}) : null,
			report ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 flex flex-wrap items-end gap-x-8 gap-y-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted",
						children: "组合收益"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: `font-serif text-4xl tabular-nums ${tone$1(report.totalReturn)}`,
						children: signedPct(report.totalReturn)
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
						className: "grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
								label: "年化",
								value: signedPct(report.annualized),
								className: tone$1(report.annualized)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
								label: "最大回撤",
								value: signedPct(report.maxDrawdown),
								className: "text-down"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
								label: "胜率",
								value: signedPct(report.winRate).replace("+", "")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
								label: "笔均净收益",
								value: signedPct(report.avgNet),
								className: tone$1(report.avgNet)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
								label: "成交笔数",
								value: String(report.taken)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
								label: "盈亏比",
								value: ratio(report.payoff)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
								label: "可买信号",
								value: String(report.signals)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
								label: "弱市少做",
								value: String(report.skippedRegime)
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3 h-36",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
						width: "100%",
						height: "100%",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(LineChart, {
							data: report.curve,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
									domain: ["auto", "auto"],
									width: 46,
									tickFormatter: (value) => value.toFixed(2),
									tick: {
										fill: "var(--color-muted)",
										fontSize: 11
									},
									axisLine: false,
									tickLine: false
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, { content: ({ active, payload, label }) => {
									if (!active || !payload?.length) return null;
									const equity = Number(payload[0].value);
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "rounded-lg bg-surface px-2 py-1 text-xs shadow-ring",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-muted",
											children: label
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: `tabular-nums ${tone$1(equity - 1)}`,
											children: signedPct(equity - 1)
										})]
									});
								} }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Line, {
									type: "monotone",
									dataKey: "equity",
									stroke: "var(--color-fg)",
									strokeWidth: 1.5,
									dot: false,
									isAnimationActive: false
								})
							]
						})
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2 text-xs leading-5 text-muted",
					children: [
						rule ? `${rule} ` : "",
						"最多同时 8 笔，每笔用当时净值的 12.5%。上证或沪深300收在 20 日线下方超过 3% 且均线向下时，只做评分不低于 76 的信号，持仓上限降到 3 笔，而且当天只新开 1 笔。这段样本里这样的弱市有 ",
						report.riskOffDays,
						" 个交易日。费用按佣金万 2.5、卖出印花税万 5、滑点单边 0.1%。回撤按平仓净值，不含持仓途中的波动，也没模拟一字跌停卖不出。样本是现在仍在交易的股票，不含已退市。",
						report.rejected.amount || report.rejected.limit ? ` 另有 ${report.rejected.amount} 笔因成交额、${report.rejected.limit} 笔因一字涨停没有买入。` : "",
						report.failed ? ` ${report.failed} 只日线没读到。` : ""
					]
				})
			] }) : null,
			loading && report ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-xs text-muted",
				children: "正在重算…"
			}) : null
		]
	});
}
function Stat({ label, value, className = "text-fg" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
		className: "text-xs text-muted",
		children: label
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
		className: `mt-0.5 tabular-nums ${className}`,
		children: value
	})] });
}
var STAGE_RANK = {
	retest: 0,
	breakout: 1,
	forming: 2,
	extended: 3
};
function tone(value) {
	if (value > 5e-4) return "text-up";
	if (value < -5e-4) return "text-down";
	return "text-muted";
}
var COPY = {
	"adam-eve": {
		title: "亚当夏娃",
		lede: "下跌末端先走出尖底亚当，再走出更宽的圆底夏娃。两底之间的高点是颈线。收盘站上颈线，才进入突破；回到颈线不破，是回踩。",
		pending: "成交额前 200 只，近两年多。先尖底，再圆底，突破颈线才进场。",
		rule: "这是原版：高位下杀后，尖底在前、圆底在后。"
	},
	"eve-adam": {
		title: "夏娃启V",
		lede: "底部先走成圆底夏娃，价格在低位来回。随后一根尖 V 拉起来，收盘越过这段区间的高点，才算起来。",
		pending: "成交额前 200 只，近两年多。先圆底，再尖 V，越过区间高点才进场。和原版分开计算。",
		rule: "这是逆向：底部区间里圆底在前，尖 V 在后，两套信号互不混用。"
	}
};
function Terminal() {
	const [book, setBook] = (0, import_react.useState)("adam-eve");
	const [size, setSize] = (0, import_react.useState)(60);
	const [boards, setBoards] = (0, import_react.useState)([
		"main",
		"chinext",
		"star"
	]);
	const [stage, setStage] = (0, import_react.useState)("trade");
	const [sort, setSort] = (0, import_react.useState)("score");
	const [code, setCode] = (0, import_react.useState)("");
	const [busyScan, setBusyScan] = (0, import_react.useState)("adam-eve");
	const [busyReport, setBusyReport] = (0, import_react.useState)("adam-eve");
	const [error, setError] = (0, import_react.useState)("");
	const [reportError, setReportError] = (0, import_react.useState)("");
	const [packs, setPacks] = (0, import_react.useState)({});
	const [reports, setReports] = (0, import_react.useState)({});
	const [picked, setPicked] = (0, import_react.useState)({
		"adam-eve": "",
		"eve-adam": ""
	});
	const result = packs[book] ?? null;
	const report = reports[book] ?? null;
	const loading = busyScan === book;
	const selected = picked[book];
	async function run(next) {
		const active = next?.book ?? book;
		const query = {
			size: next?.size ?? size,
			boards: next?.boards ?? boards,
			code: next?.code ?? "",
			book: active
		};
		setBusyScan(active);
		setError("");
		try {
			const data = await scanMarket({ data: query });
			setPacks((current) => ({
				...current,
				[active]: data
			}));
			setPicked((current) => ({
				...current,
				[active]: data.focus?.code || data.hits[0]?.code || ""
			}));
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "行情源没有回应");
		} finally {
			setBusyScan((current) => current === active ? null : current);
		}
	}
	async function loadReport(refresh = false, which) {
		const active = which ?? book;
		setBusyReport(active);
		setReportError("");
		try {
			const data = await backtestStrategy({ data: {
				refresh,
				book: active
			} });
			setReports((current) => ({
				...current,
				[active]: data
			}));
		} catch (cause) {
			setReportError(cause instanceof Error ? cause.message : "回测没有跑完");
		} finally {
			setBusyReport((current) => current === active ? null : current);
		}
	}
	function openBook(next) {
		setBook(next);
		setError("");
		setReportError("");
		if (!packs[next]) run({
			book: next,
			code: ""
		});
		if (!reports[next]) loadReport(false, next);
	}
	(0, import_react.useEffect)(() => {
		run();
		const timer = window.setTimeout(() => void loadReport(), 1200);
		return () => window.clearTimeout(timer);
	}, []);
	function toggleBoard(board) {
		setBoards((current) => {
			const has = current.includes(board);
			if (has && current.length === 1) return current;
			return has ? current.filter((item) => item !== board) : [...current, board];
		});
	}
	const visible = (0, import_react.useMemo)(() => {
		const copy = [...(result?.hits ?? []).filter((hit) => {
			const kind = hit.pattern?.stage;
			if (!kind) return false;
			if (stage === "all" || stage === "trade") {
				if (stage === "trade" && kind === "extended") return false;
				return true;
			}
			return kind === stage;
		})];
		copy.sort((a, b) => {
			const left = a.pattern;
			const right = b.pattern;
			if (!left || !right) return 0;
			if (sort === "rr") return right.rewardRisk - left.rewardRisk;
			if (sort === "fresh") {
				const age = (hit) => {
					const index = hit.pattern?.breakoutIndex;
					if (index == null) return hit.bars.length;
					return hit.bars.length - 1 - index;
				};
				return age(a) - age(b) || right.score - left.score;
			}
			const stageDelta = STAGE_RANK[left.stage] - STAGE_RANK[right.stage];
			if (stageDelta) return stageDelta;
			return right.score - left.score;
		});
		return copy;
	}, [
		result,
		stage,
		sort
	]);
	const active = result?.focus?.code === selected ? result.focus : visible.find((hit) => hit.code === selected) ?? result?.hits.find((hit) => hit.code === selected) ?? result?.focus ?? null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen bg-bg text-fg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
			className: "border-b border-line",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "max-w-xl",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs tracking-widest text-muted",
							children: "A SHARE · DAILY · 两套分开"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 flex flex-wrap gap-2",
							children: [["adam-eve", "亚当夏娃"], ["eve-adam", "夏娃启V"]].map(([key, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => openBook(key),
								className: book === key ? "h-10 rounded-full bg-fg px-4 text-sm text-bg" : "h-10 rounded-full border border-line px-4 text-sm text-muted",
								children: label
							}, key))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "mt-3 font-serif text-3xl text-fg sm:text-4xl",
							children: COPY[book].title
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-sm leading-6 text-muted",
							children: COPY[book].lede
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					className: "flex w-full flex-col gap-2 sm:max-w-sm",
					onSubmit: (event) => {
						event.preventDefault();
						const digits = code.replace(/\D/g, "");
						if (digits.length !== 6) {
							setError("请输入 6 位 A 股代码");
							return;
						}
						run({ code: digits });
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "text-xs text-muted",
						htmlFor: "code",
						children: "单票复核"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							id: "code",
							inputMode: "numeric",
							autoComplete: "off",
							maxLength: 6,
							value: code,
							placeholder: "600519",
							onChange: (event) => setCode(event.target.value),
							className: "h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-fg outline-none placeholder:text-muted focus:shadow-ring-strong"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "submit",
							disabled: loading,
							className: "inline-flex h-11 items-center gap-1.5 rounded-lg bg-fg px-4 text-sm font-medium text-bg disabled:opacity-50",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
								className: "size-4",
								strokeWidth: 1.75
							}), "查看"]
						})]
					})]
				})]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
			className: "mx-auto grid max-w-6xl gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[22rem_minmax(0,1fr)]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StrategyPanel, {
					report,
					loading: busyReport === book,
					error: reportError,
					onRetry: () => void loadReport(true),
					title: book === "eve-adam" ? "逆向收益" : "策略收益",
					pending: COPY[book].pending,
					rule: COPY[book].rule
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "contents lg:sticky lg:top-4 lg:flex lg:max-h-screen lg:min-w-0 lg:flex-col lg:gap-3 lg:overflow-auto",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "order-1 rounded-2xl bg-surface p-3 shadow-ring lg:order-none",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-wrap gap-2",
								children: [60, 100].map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setSize(option),
									className: size === option ? "h-10 rounded-full bg-fg px-3 text-sm text-bg" : "h-10 rounded-full px-3 text-sm text-muted",
									children: ["成交额前 ", option]
								}, option))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-2 flex flex-wrap gap-2",
								children: [
									["main", "主板"],
									["chinext", "创业板"],
									["star", "科创板"]
								].map(([key, label]) => {
									const on = boards.includes(key);
									return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => toggleBoard(key),
										className: on ? "h-10 rounded-full bg-fg px-3 text-sm text-bg" : "h-10 rounded-full border border-line px-3 text-sm text-muted",
										children: label
									}, key);
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: loading,
								onClick: () => void run({
									size,
									boards,
									code: ""
								}),
								className: "mt-3 h-11 w-full rounded-lg bg-up text-sm font-medium text-fg disabled:opacity-50",
								children: loading ? "正在读日线…" : "扫描这批样本"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-xs leading-5 text-muted",
								children: result ? `${result.universe} · 已扫 ${result.scanned} 只${result.failed ? ` · ${result.failed} 只无数据` : ""} · 截至 ${result.asOf || "—"}` : "剔除 ST、退市整理、上市不足 60 日、近 20 日均成交额低于 8000 万、停牌和一字涨停。"
							}),
							result?.regime ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: `mt-1 text-xs leading-5 ${result.regime.riskOff ? "text-fg" : "text-muted"}`,
								children: result.regime.detail
							}) : null
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "order-3 flex flex-col gap-3 lg:order-none",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-wrap gap-2",
								children: [
									["trade", "可交易"],
									["forming", "构筑"],
									["breakout", "突破"],
									["retest", "回踩"],
									["extended", "延伸"],
									["all", "全部"]
								].map(([key, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setStage(key),
									className: stage === key ? "h-10 rounded-full bg-fg px-3 text-xs text-bg" : "h-10 rounded-full border border-line px-3 text-xs text-muted",
									children: label
								}, key))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-wrap gap-x-3 gap-y-1 text-xs",
								children: [
									["score", "按阶段与评分"],
									["rr", "按盈亏比"],
									["fresh", "按突破远近"]
								].map(([key, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setSort(key),
									className: sort === key ? "h-10 text-fg" : "h-10 text-muted",
									children: label
								}, key))
							}),
							error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "rounded-xl bg-surface px-3 py-3 text-sm text-up",
								children: error
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-2",
								children: [
									loading && !result ? Array.from({ length: 4 }, (_, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-24 animate-pulse rounded-2xl bg-surface motion-reduce:animate-none" }, index)) : null,
									!loading && visible.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "rounded-2xl bg-surface px-4 py-5 text-sm leading-6 text-muted",
										children: result?.universe === "单票" && result.focus ? `${result.focus.name} 现在不是可交易形态。历史机会在图的下方。` : result?.focus && !result.focus.pattern ? `${result.focus.name} 当前日线里没有够干净的亚当夏娃。K 线仍然可以看。` : "这批样本里没有符合当前筛选的形态。可以换成「全部」，或加大到成交额前 100。另一套形态在页顶切换，不会混进这里。"
									}) : null,
									visible.map((hit) => {
										const pattern = hit.pattern;
										if (!pattern) return null;
										const on = active?.code === hit.code;
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											onClick: () => {
												setPicked((current) => ({
													...current,
													[book]: hit.code
												}));
												setPacks((current) => {
													const pack = current[book];
													return pack ? {
														...current,
														[book]: {
															...pack,
															focus: hit
														}
													} : current;
												});
											},
											className: on ? "rounded-2xl bg-surface px-3 py-3 text-left shadow-ring-strong" : "rounded-2xl bg-surface px-3 py-3 text-left shadow-ring",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-baseline justify-between gap-3",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-serif text-lg",
														children: hit.name
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "tabular-nums text-up",
														children: pattern.score
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "mt-1 flex items-center justify-between gap-2 text-xs text-muted",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
														hit.code,
														" · ",
														BOARD_LABEL[hit.board],
														" · ",
														STAGE_LABEL[pattern.stage]
													] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: `tabular-nums ${tone(hit.changePct)}`,
														children: signedPct(hit.changePct)
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "mt-2 grid grid-cols-3 gap-2 text-xs",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "text-muted",
															children: ["颈线 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "tabular-nums text-fg",
																children: price(pattern.neckline)
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "text-muted",
															children: ["盈亏比 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "tabular-nums text-fg",
																children: ratio(pattern.rewardRisk)
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-right text-muted",
															children: amountYi(hit.amount)
														})
													]
												})
											]
										}, hit.code);
									})
								]
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					className: "order-2 min-w-0 lg:order-none",
					children: active ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Detail, {
						hit: active,
						book
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rules, { book })
				})
			]
		})]
	});
}
function Detail({ hit, book }) {
	const [dossier, setDossier] = (0, import_react.useState)(hit.history ? hit : null);
	const [loadingHistory, setLoadingHistory] = (0, import_react.useState)(hit.history == null);
	const [pick, setPick] = (0, import_react.useState)(null);
	const eveFirst = book === "eve-adam";
	(0, import_react.useEffect)(() => {
		setPick(null);
		if (hit.history) {
			setDossier(hit);
			setLoadingHistory(false);
			return;
		}
		let cancel = false;
		setDossier(null);
		setLoadingHistory(true);
		scanMarket({ data: {
			size: 60,
			boards: [
				"main",
				"chinext",
				"star"
			],
			code: hit.code,
			book
		} }).then((result) => {
			if (!cancel) setDossier(result.focus);
		}).catch(() => {
			if (!cancel) setDossier(null);
		}).finally(() => {
			if (!cancel) setLoadingHistory(false);
		});
		return () => {
			cancel = true;
		};
	}, [hit, book]);
	const source = dossier ?? hit;
	const trades = source.history ?? [];
	const autoPick = source.pattern ? null : trades.findIndex((trade) => trade.outcome !== "missed");
	const resolvedPick = pick ?? (autoPick != null && autoPick >= 0 ? autoPick : !source.pattern && trades.length > 0 ? 0 : null);
	const chartTrade = resolvedPick == null ? null : trades[resolvedPick] ?? null;
	const view = clipPattern(source.bars, chartTrade?.pattern ?? source.pattern);
	const pattern = source.pattern;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "rounded-2xl bg-surface p-3 shadow-ring sm:p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-end justify-between gap-3 px-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "font-serif text-2xl",
					children: [hit.name, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-2 text-base text-muted",
						children: hit.code
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-sm text-muted",
					children: [
						BOARD_LABEL[hit.board],
						chartTrade ? ` · ${chartTrade.signalDate} · ${OUTCOME_LABEL[chartTrade.outcome]}` : pattern ? ` · ${STAGE_LABEL[pattern.stage]}` : " · 当前没有可交易的双底",
						source.gate ? ` · ${source.gate}` : ""
					]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-right",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: `font-serif text-2xl tabular-nums ${tone(hit.changePct)}`,
						children: price(hit.price)
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: `text-sm tabular-nums ${tone(hit.changePct)}`,
						children: signedPct(hit.changePct)
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PriceChart, {
					bars: view.bars,
					pattern: view.pattern,
					eveFirst
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HistoryBoard, {
				trades,
				loading: loadingHistory,
				since: source.bars[0]?.date ?? "",
				highlight: resolvedPick,
				showCurrent: Boolean(pattern),
				onPick: setPick,
				book
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 grid gap-3 sm:grid-cols-2",
				children: [chartTrade ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PastPlan, { trade: chartTrade }) : pattern ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plan, { hit: {
					...source,
					pattern
				} }) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metrics, { hit: source })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rules, {
					compact: true,
					book
				})
			})
		]
	});
}
function historySummary(trades) {
	const closed = trades.filter((trade) => trade.outcome === "target" || trade.outcome === "stop" || trade.outcome === "expired");
	if (!closed.length) return `共 ${trades.length} 次形态，还没有走完的样本。`;
	const wins = closed.filter((trade) => trade.outcome === "target").length;
	const avg = closed.reduce((sum, trade) => sum + trade.returnPct, 0) / closed.length;
	return `已结束 ${closed.length} 次，先到目标 ${wins} 次，平均收益 ${signedPct(avg)}。`;
}
function HistoryBoard({ trades, loading, since, highlight, showCurrent, onPick, book }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-baseline justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "font-serif text-base",
					children: "历史机会"
				}), loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-xs text-muted",
					children: "回看中…"
				}) : null]
			}),
			!loading && trades.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm leading-6 text-muted",
				children: book === "eve-adam" ? "这段前复权日线里没有扫到先圆底、再尖 V 的底部。" : "这段前复权日线里没有扫到完整的亚当夏娃。"
			}) : null,
			trades.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-sm leading-6 text-muted",
				children: [since ? `自 ${since} 起，` : "", historySummary(trades)]
			}) : null,
			trades.length > 0 || showCurrent ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex gap-2 overflow-x-auto pb-1",
				children: [showCurrent ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => onPick(null),
					className: highlight == null ? "h-16 shrink-0 rounded-xl bg-fg px-3 text-left text-bg" : "h-16 shrink-0 rounded-xl border border-line px-3 text-left text-fg",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block text-xs opacity-70",
						children: "现在"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-1 block text-sm",
						children: "当前走势"
					})]
				}) : null, trades.map((trade, index) => {
					const on = highlight === index;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => onPick(index),
						className: on ? "h-16 shrink-0 rounded-xl bg-fg px-3 text-left text-bg" : "h-16 shrink-0 rounded-xl border border-line px-3 text-left text-fg",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: `block text-xs ${on ? "opacity-70" : "text-muted"}`,
							children: trade.signalDate
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "mt-1 block text-sm",
							children: [OUTCOME_LABEL[trade.outcome], /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: `ml-2 tabular-nums ${on ? "" : tone(trade.returnPct)}`,
								children: trade.outcome === "missed" ? "" : signedPct(trade.returnPct)
							})]
						})]
					}, `${trade.signalDate}-${trade.pattern.eveIndex}`);
				})]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-xs leading-5 text-muted",
				children: "突破日收盘进场，之后 30 个交易日内先碰目标还是先碰止损。同一根 K 线都碰到，记为止损。"
			})
		]
	});
}
function PastPlan({ trade }) {
	const missed = trade.outcome === "missed";
	const rows = missed ? [
		["夏娃", trade.signalDate],
		["颈线", price(trade.pattern.neckline)],
		["结果", "价格没有站上颈线"],
		["评分", String(trade.pattern.score)]
	] : [
		["信号", trade.signalDate],
		["入场", price(trade.pattern.entry)],
		["止损", price(trade.pattern.stop)],
		["目标", price(trade.pattern.target)],
		["结果", OUTCOME_LABEL[trade.outcome]],
		["收益", signedPct(trade.returnPct)],
		["持有", `${trade.holdDays} 日`],
		["离场", `${trade.exitDate} · ${price(trade.exitPrice)}`]
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-line p-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
			className: "font-serif text-base",
			children: missed ? "未触发的形态" : "这次回测"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dl", {
			className: "mt-3 grid grid-cols-2 gap-x-3 gap-y-3 text-sm",
			children: rows.map(([label, value]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
				className: "text-xs text-muted",
				children: label
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
				className: "mt-0.5 tabular-nums text-fg",
				children: value
			})] }, label))
		})]
	});
}
function Plan({ hit }) {
	const pattern = hit.pattern;
	if (!pattern) return null;
	const rows = [
		["入场", pattern.stage === "forming" ? `颈线 ${price(pattern.entry)}` : `现价 ${price(pattern.entry)}`],
		["止损", `${price(pattern.stop)} · 两底较低者下方`],
		["目标", `${price(pattern.target)} · 颈线加上形态高度`],
		["盈亏比", ratio(pattern.rewardRisk)],
		["底距", signedPct(pattern.lowGap).replace("+", "")],
		["先前跌幅", signedPct(-pattern.priorDrop)],
		["亚当宽度", `${pattern.adamWidth} 根`],
		["夏娃宽度", `${pattern.eveWidth} 根`]
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-line p-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "font-serif text-base",
				children: "交易计划"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dl", {
				className: "mt-3 grid grid-cols-2 gap-x-3 gap-y-3 text-sm",
				children: rows.map(([label, value]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
					className: "text-xs text-muted",
					children: label
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
					className: "mt-0.5 tabular-nums text-fg",
					children: value
				})] }, label))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-xs leading-5 text-muted",
				children: "构筑阶段的入场价是颈线，不是现价。延伸阶段往往已经吃掉测量涨幅，盈亏比会变差。"
			})
		]
	});
}
function Metrics({ hit }) {
	const pattern = hit.pattern;
	const rows = [
		[
			"ATR 倍数",
			multiple(hit.atrMultipleFromMa),
			"收盘相对 20 日均线，以 ATR 计"
		],
		[
			"偏离均线",
			signedPct(hit.gainFromMaPct),
			"收盘相对 20 日均线"
		],
		[
			"ATR%",
			signedPct(hit.atrPct).replace("+", ""),
			`ATR ${price(hit.atr)}`
		],
		[
			"相对量能",
			`${ratio(pattern?.rvol ?? hit.rvol)}x`,
			pattern ? "突破日或最近一日 / 前 20 日" : "最近一日 / 前 20 日"
		],
		[
			"量能较均量",
			signedPct(hit.volVsAvg),
			"最近一根相对前 20 日"
		],
		[
			"60 日均线",
			price(hit.ma60),
			`20 日 ${price(hit.ma)}`
		]
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-line p-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
			className: "font-serif text-base",
			children: "结构读数"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dl", {
			className: "mt-3 flex flex-col gap-3",
			children: rows.map(([label, value, note]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-baseline justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
					className: "text-sm text-fg",
					children: label
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
					className: "text-xs text-muted",
					children: note
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "tabular-nums text-sm text-fg",
					children: value
				})]
			}, label))
		})]
	});
}
function Rules({ compact = false, book = "adam-eve" }) {
	const reverse = book === "eve-adam";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: compact ? "rounded-xl border border-line p-3" : "rounded-2xl bg-surface p-4 shadow-ring sm:p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-serif text-xl",
				children: compact ? "规则" : reverse ? "逆向在找什么" : "这套扫描在找什么"
			}),
			!compact ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 max-w-2xl text-sm leading-6 text-muted",
				children: reverse ? "先在底部走出一只宽碗，再来一根尖 V。碗是夏娃，针是起来的那一下。两段之间的高点是颈线。" : "亚当与夏娃是向上反转的双底。左边的底窄而尖，像一根针；右边的底宽而圆，像一只碗。中间反弹的高点连成颈线。"
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 grid gap-4 sm:grid-cols-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-sm text-fg",
						children: reverse ? "夏娃在前" : "亚当"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm leading-6 text-muted",
						children: reverse ? "底部区间里的圆底。价格已经在低位来回，不是从高位一路扎下来的那根针。低点附近要有一段宽度。" : "下跌之后的尖底。附近只有很少几根 K 线贴着低点，低点相对左右邻居有明显下刺。"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-sm text-fg",
						children: reverse ? "然后 V 起来" : "夏娃"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm leading-6 text-muted",
						children: reverse ? "圆底之后的尖底。它不该明显击穿夏娃。随后很少几根 K 线里，收盘要冲过区间高点。慢吞吞磨上去的不算。" : "出现在亚当之后。底部更宽，价格在低位来回，而不是单日长针。两个低点要接近，夏娃不该明显击穿亚当。"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-sm text-fg",
						children: "颈线与进场"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm leading-6 text-muted",
						children: "颈线取两底之间的最高价。收盘价站上颈线才进场；之后再次靠近颈线且守住，记为回踩。止损放在两底较低者略下方。"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-sm text-fg",
						children: "目标"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm leading-6 text-muted",
						children: "测量涨幅等于颈线减去底部。价格已经远离颈线、或相对 20 日均线拉出太多 ATR，会标成延伸，不再当作新鲜买点。"
					})] })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-4 text-xs leading-5 text-muted",
				children: [reverse ? "这一页和亚当夏娃分开扫描、分开回测。" : "前复权日线，红涨绿跌。", "规则扫描只描述形态，不是买卖指令，也不保证下一根 K 线。"]
			})
		]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Terminal, {});
}
//#endregion
export { Home as component };
