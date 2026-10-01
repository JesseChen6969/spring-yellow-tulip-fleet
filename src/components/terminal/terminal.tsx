import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { clipPattern, OUTCOME_LABEL, STAGE_LABEL, type PastTrade, type Stage } from "@/lib/pattern/adam-eve";
import { scanMarket, backtestStrategy, type Board, type Book, type ScanHit, type ScanResult, type Span, type StrategyReport } from "@/lib/market/scan";
import { PriceChart } from "@/components/terminal/price-chart";
import { StrategyPanel } from "@/components/terminal/strategy-panel";
import { amountYi, BOARD_LABEL, multiple, price, ratio, signedPct } from "@/components/terminal/format";

type StageFilter = "trade" | Stage | "all";
type SortKey = "score" | "rr" | "fresh";

const STAGE_RANK: Record<Stage, number> = {
  retest: 0,
  breakout: 1,
  forming: 2,
  extended: 3,
};

function tone(value: number) {
  if (value > 0.0005) return "text-up";
  if (value < -0.0005) return "text-down";
  return "text-muted";
}

const COPY: Record<Book, { title: string; lede: string; rule: string; pending: string }> = {
  "adam-eve": {
    title: "亚当夏娃",
    lede: "下跌末端先走出尖底亚当，再走出更宽的圆底夏娃。两底之间的高点是颈线。收盘站上颈线，才进入突破；回到颈线不破，是回踩。",
    pending: "成交额前 200 只，近两年多。先尖底，再圆底，突破颈线才进场。",
    rule: "这是原版：高位下杀后，尖底在前、圆底在后。",
  },
  "eve-adam": {
    title: "夏娃启V",
    lede: "底部先走成圆底夏娃，价格在低位来回。随后一根尖 V 拉起来，收盘越过这段区间的高点，才算起来。",
    pending: "流动性池约 500 只，不按当日成交额前 100。近 20 日均额仍要过 8000 万。",
    rule: "这是逆向：底部区间里圆底在前，尖 V 在后，两套信号互不混用。",
  },
};

export function Terminal() {
  const [book, setBook] = useState<Book>("adam-eve");
  const [size, setSize] = useState<60 | 100>(60);
  const [depth, setDepth] = useState<800 | 1600>(800);
  const [boards, setBoards] = useState<Board[]>(["main", "chinext", "star"]);
  const [stage, setStage] = useState<StageFilter>("trade");
  const [sort, setSort] = useState<SortKey>("score");
  const [code, setCode] = useState("");
  const [busyScan, setBusyScan] = useState<Book | null>("adam-eve");
  const [span, setSpan] = useState<Span>("2y");
  const [busyReport, setBusyReport] = useState<string | null>("adam-eve");
  const [error, setError] = useState("");
  const [reportError, setReportError] = useState("");
  const [packs, setPacks] = useState<Partial<Record<Book, ScanResult>>>({});
  const [reports, setReports] = useState<Partial<Record<string, StrategyReport>>>({});
  const [picked, setPicked] = useState<Record<Book, string>>({ "adam-eve": "", "eve-adam": "" });
  const result = packs[book] ?? null;
  const reportId = book === "eve-adam" && span === "20y" ? "eve-adam:20y" : book;
  const report = reports[reportId] ?? null;
  const loading = busyScan === book;
  const selected = picked[book];

  async function run(next?: { size?: 60 | 100; boards?: Board[]; code?: string; book?: Book; depth?: 800 | 1600 }) {
    const active = next?.book ?? book;
    const query = {
      size: next?.size ?? size,
      depth: next?.depth ?? depth,
      boards: next?.boards ?? boards,
      code: next?.code ?? "",
      book: active,
    };
    setBusyScan(active);
    setError("");
    try {
      const data = await scanMarket({ data: query });
      setPacks((current) => ({ ...current, [active]: data }));
      setPicked((current) => ({
        ...current,
        [active]: data.focus?.code || data.hits[0]?.code || "",
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "行情源没有回应");
    } finally {
      setBusyScan((current) => (current === active ? null : current));
    }
  }

  async function loadReport(refresh = false, which?: Book, nextSpan?: Span) {
    const active = which ?? book;
    const chosen = active === "eve-adam" ? (nextSpan ?? span) : "2y";
    const id = active === "eve-adam" && chosen === "20y" ? "eve-adam:20y" : active;
    setBusyReport(id);
    setReportError("");
    try {
      const data = await backtestStrategy({ data: { refresh, book: active, span: chosen } });
      setReports((current) => ({ ...current, [id]: data }));
    } catch (cause) {
      setReportError(cause instanceof Error ? cause.message : "回测没有跑完");
    } finally {
      setBusyReport((current) => (current === id ? null : current));
    }
  }

  function chooseSpan(next: Span) {
    setSpan(next);
    setReportError("");
    const id = next === "20y" ? "eve-adam:20y" : "eve-adam";
    if (!reports[id]) void loadReport(false, "eve-adam", next);
  }

  function openBook(next: Book) {
    setBook(next);
    setError("");
    setReportError("");
    if (!packs[next]) void run({ book: next, code: "" });
    if (!reports[next]) void loadReport(false, next);
  }

  useEffect(() => {
    void run();
    const timer = window.setTimeout(() => void loadReport(), 1200);
    return () => window.clearTimeout(timer);
    // The book starts after the scan has taken the first quotes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleBoard(board: Board) {
    setBoards((current) => {
      const has = current.includes(board);
      if (has && current.length === 1) return current;
      return has ? current.filter((item) => item !== board) : [...current, board];
    });
  }

  const visible = useMemo(() => {
    const hits = result?.hits ?? [];
    const filtered = hits.filter((hit) => {
      const kind = hit.pattern?.stage;
      if (!kind) return false;
      if (stage === "all" || stage === "trade") {
        if (stage === "trade" && kind === "extended") return false;
        return true;
      }
      return kind === stage;
    });
    const copy = [...filtered];
    copy.sort((a, b) => {
      const left = a.pattern;
      const right = b.pattern;
      if (!left || !right) return 0;
      if (sort === "rr") return right.rewardRisk - left.rewardRisk;
      if (sort === "fresh") {
        const age = (hit: ScanHit) => {
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
  }, [result, stage, sort]);

  const active =
    result?.focus?.code === selected
      ? result.focus
      : (visible.find((hit) => hit.code === selected) ??
        result?.hits.find((hit) => hit.code === selected) ??
        result?.focus ??
        null);

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="text-xs tracking-widest text-muted">A SHARE · DAILY · 两套分开</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ["adam-eve", "亚当夏娃"],
                  ["eve-adam", "夏娃启V"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => openBook(key)}
                  className={
                    book === key
                      ? "h-10 rounded-full bg-fg px-4 text-sm text-bg"
                      : "h-10 rounded-full border border-line px-4 text-sm text-muted"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <h1 className="mt-3 font-serif text-3xl text-fg sm:text-4xl">{COPY[book].title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted">{COPY[book].lede}</p>
          </div>
          <form
            className="flex w-full flex-col gap-2 sm:max-w-sm"
            onSubmit={(event) => {
              event.preventDefault();
              const digits = code.replace(/\D/g, "");
              if (digits.length !== 6) {
                setError("请输入 6 位 A 股代码");
                return;
              }
              void run({ code: digits });
            }}
          >
            <label className="text-xs text-muted" htmlFor="code">
              单票复核
            </label>
            <div className="flex gap-2">
              <input
                id="code"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={code}
                placeholder="600519"
                onChange={(event) => setCode(event.target.value)}
                className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-fg outline-none placeholder:text-muted focus:shadow-ring-strong"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-fg px-4 text-sm font-medium text-bg disabled:opacity-50"
              >
                <Search className="size-4" strokeWidth={1.75} />
                查看
              </button>
            </div>
          </form>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <StrategyPanel
          report={report}
          loading={busyReport === reportId}
          error={reportError}
          onRetry={() => void loadReport(true, book, book === "eve-adam" ? span : "2y")}
          title={book === "eve-adam" ? "逆向收益" : "策略收益"}
          pending={
            book === "eve-adam" && span === "20y"
              ? "正在拼接 2006 年 9 月以来的日线。同一批约 500 只，会比近两年慢很多。"
              : COPY[book].pending
          }
          rule={
            book === "eve-adam" && span === "20y"
              ? "同一套逆向规则，从 2006-09-23 算到现在。股票仍是今天还活跃的约 500 只，退市的不在里面，所以这不是当年的全市场。8000 万成交额按当时的名义金额，早年多数信号过不了。"
              : COPY[book].rule
          }
          sample={book === "eve-adam" ? "流动性池" : "成交额前"}
          span={span}
          onSpan={book === "eve-adam" ? chooseSpan : undefined}
        />
        <div className="contents lg:sticky lg:top-4 lg:flex lg:max-h-screen lg:min-w-0 lg:flex-col lg:gap-3 lg:overflow-auto">
          <div className="order-1 rounded-2xl bg-surface p-3 shadow-ring lg:order-none">
            <div className="flex flex-wrap gap-2">
              {book === "eve-adam"
                ? ([800, 1600] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setDepth(option);
                        void run({ depth: option, book, code: "" });
                      }}
                      className={
                        depth === option
                          ? "h-10 rounded-full bg-fg px-3 text-sm text-bg"
                          : "h-10 rounded-full px-3 text-sm text-muted"
                      }
                    >
                      往下 {option}
                    </button>
                  ))
                : ([60, 100] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSize(option)}
                      className={
                        size === option
                          ? "h-10 rounded-full bg-fg px-3 text-sm text-bg"
                          : "h-10 rounded-full px-3 text-sm text-muted"
                      }
                    >
                      成交额前 {option}
                    </button>
                  ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ["main", "主板"],
                  ["chinext", "创业板"],
                  ["star", "科创板"],
                ] as const
              ).map(([key, label]) => {
                const on = boards.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleBoard(key)}
                    className={
                      on
                        ? "h-10 rounded-full bg-fg px-3 text-sm text-bg"
                        : "h-10 rounded-full border border-line px-3 text-sm text-muted"
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={() => void run({ size, boards, code: "" })}
              className="mt-3 h-11 w-full rounded-lg bg-up text-sm font-medium text-fg disabled:opacity-50"
            >
              {loading ? "正在读日线…" : "扫描这批样本"}
            </button>
            <p className="mt-2 text-xs leading-5 text-muted">
              {result
                ? `${result.universe} · 已扫 ${result.scanned} 只${result.failed ? ` · ${result.failed} 只无数据` : ""} · 截至 ${result.asOf || "—"}`
                : book === "eve-adam"
                  ? "底部不看当日成交额前 100。从成交额高的往下取，近 20 日均额低于 8000 万的仍然剔除。"
                  : "剔除 ST、退市整理、上市不足 60 日、近 20 日均成交额低于 8000 万、停牌和一字涨停。"}
            </p>
            {result?.regime ? (
              <p className={`mt-1 text-xs leading-5 ${result.regime.riskOff ? "text-fg" : "text-muted"}`}>
                {result.regime.detail}
              </p>
            ) : null}
          </div>

          <div className="order-3 flex flex-col gap-3 lg:order-none">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["trade", "可交易"],
                ["forming", "构筑"],
                ["breakout", "突破"],
                ["retest", "回踩"],
                ["extended", "延伸"],
                ["all", "全部"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStage(key)}
                className={
                  stage === key
                    ? "h-10 rounded-full bg-fg px-3 text-xs text-bg"
                    : "h-10 rounded-full border border-line px-3 text-xs text-muted"
                }
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {(
              [
                ["score", "按阶段与评分"],
                ["rr", "按盈亏比"],
                ["fresh", "按突破远近"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSort(key)}
                className={sort === key ? "h-10 text-fg" : "h-10 text-muted"}
              >
                {label}
              </button>
            ))}
          </div>

          {error ? <p className="rounded-xl bg-surface px-3 py-3 text-sm text-up">{error}</p> : null}

          <div className="flex flex-col gap-2">
            {loading && !result
              ? Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="h-24 animate-pulse rounded-2xl bg-surface motion-reduce:animate-none" />
                ))
              : null}
            {!loading && visible.length === 0 ? (
              <div className="rounded-2xl bg-surface px-4 py-5 text-sm leading-6 text-muted">
                {result?.universe === "单票" && result.focus
                  ? `${result.focus.name} 现在不是可交易形态。历史机会在图的下方。`
                  : result?.focus && !result.focus.pattern
                    ? `${result.focus.name} 当前日线里没有${book === "eve-adam" ? "先圆底再尖 V 的底部" : "够干净的亚当夏娃"}。K 线仍然可以看。`
                    : book === "eve-adam"
                      ? "这批流动性池里没有符合的底部。可以换成「往下 1600」，原版名单不会混进来。"
                      : "这批样本里没有符合当前筛选的形态。可以换成「全部」，或加大到成交额前 100。另一套形态在页顶切换，不会混进这里。"}
              </div>
            ) : null}
            {visible.map((hit) => {
              const pattern = hit.pattern;
              if (!pattern) return null;
              const on = active?.code === hit.code;
              return (
                <button
                  key={hit.code}
                  type="button"
                  onClick={() => {
                    setPicked((current) => ({ ...current, [book]: hit.code }));
                    setPacks((current) => {
                      const pack = current[book];
                      return pack ? { ...current, [book]: { ...pack, focus: hit } } : current;
                    });
                  }}
                  className={
                    on
                      ? "rounded-2xl bg-surface px-3 py-3 text-left shadow-ring-strong"
                      : "rounded-2xl bg-surface px-3 py-3 text-left shadow-ring"
                  }
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-serif text-lg">{hit.name}</span>
                    <span className="tabular-nums text-up">{pattern.score}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
                    <span>
                      {hit.code} · {BOARD_LABEL[hit.board]} · {STAGE_LABEL[pattern.stage]}
                    </span>
                    <span className={`tabular-nums ${tone(hit.changePct)}`}>{signedPct(hit.changePct)}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <span className="text-muted">
                      颈线 <span className="tabular-nums text-fg">{price(pattern.neckline)}</span>
                    </span>
                    <span className="text-muted">
                      盈亏比 <span className="tabular-nums text-fg">{ratio(pattern.rewardRisk)}</span>
                    </span>
                    <span className="text-right text-muted">{amountYi(hit.amount)}</span>
                  </div>
                </button>
              );
            })}
          </div>
          </div>
        </div>

        <section className="order-2 min-w-0 lg:order-none">
          {active ? <Detail hit={active} book={book} /> : <Rules book={book} />}
        </section>
      </main>
    </div>
  );
}

function Detail({ hit, book }: { hit: ScanHit; book: Book }) {
  const [dossier, setDossier] = useState<ScanHit | null>(hit.history ? hit : null);
  const [loadingHistory, setLoadingHistory] = useState(hit.history == null);
  const [pick, setPick] = useState<number | null>(null);
  const eveFirst = book === "eve-adam";

  useEffect(() => {
    setPick(null);
    if (hit.history) {
      setDossier(hit);
      setLoadingHistory(false);
      return;
    }
    let cancel = false;
    setDossier(null);
    setLoadingHistory(true);
    scanMarket({ data: { size: 60, boards: ["main", "chinext", "star"], code: hit.code, book } })
      .then((result) => {
        if (!cancel) setDossier(result.focus);
      })
      .catch(() => {
        if (!cancel) setDossier(null);
      })
      .finally(() => {
        if (!cancel) setLoadingHistory(false);
      });
    return () => {
      cancel = true;
    };
  }, [hit, book]);

  const source = dossier ?? hit;
  const trades = source.history ?? [];
  const autoPick = source.pattern
    ? null
    : trades.findIndex((trade) => trade.outcome !== "missed");
  const resolvedPick =
    pick ?? (autoPick != null && autoPick >= 0 ? autoPick : !source.pattern && trades.length > 0 ? 0 : null);
  const chartTrade = resolvedPick == null ? null : (trades[resolvedPick] ?? null);
  const view = clipPattern(source.bars, chartTrade?.pattern ?? source.pattern);
  const pattern = source.pattern;

  return (
    <article className="rounded-2xl bg-surface p-3 shadow-ring sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h2 className="font-serif text-2xl">
            {hit.name}
            <span className="ml-2 text-base text-muted">{hit.code}</span>
          </h2>
          <p className="mt-1 text-sm text-muted">
            {BOARD_LABEL[hit.board]}
            {chartTrade
              ? ` · ${chartTrade.signalDate} · ${OUTCOME_LABEL[chartTrade.outcome]}`
              : pattern
                ? ` · ${STAGE_LABEL[pattern.stage]}`
                : " · 当前没有可交易的双底"}
            {source.gate ? ` · ${source.gate}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className={`font-serif text-2xl tabular-nums ${tone(hit.changePct)}`}>{price(hit.price)}</p>
          <p className={`text-sm tabular-nums ${tone(hit.changePct)}`}>{signedPct(hit.changePct)}</p>
        </div>
      </div>

      <div className="mt-3">
        <PriceChart bars={view.bars} pattern={view.pattern} eveFirst={eveFirst} />
      </div>

      <HistoryBoard
        trades={trades}
        loading={loadingHistory}
        since={source.bars[0]?.date ?? ""}
        highlight={resolvedPick}
        showCurrent={Boolean(pattern)}
        onPick={setPick}
        book={book}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {chartTrade ? <PastPlan trade={chartTrade} /> : pattern ? <Plan hit={{ ...source, pattern }} book={book} /> : null}
        <Metrics hit={source} />
      </div>

      <div className="mt-4">
        <Rules compact book={book} />
      </div>
    </article>
  );
}

function historySummary(trades: PastTrade[]) {
  const closed = trades.filter(
    (trade) => trade.outcome === "target" || trade.outcome === "stop" || trade.outcome === "expired",
  );
  if (!closed.length) return `共 ${trades.length} 次形态，还没有走完的样本。`;
  const wins = closed.filter((trade) => trade.outcome === "target").length;
  const avg = closed.reduce((sum, trade) => sum + trade.returnPct, 0) / closed.length;
  return `已结束 ${closed.length} 次，先到目标 ${wins} 次，平均收益 ${signedPct(avg)}。`;
}

function HistoryBoard({
  trades,
  loading,
  since,
  highlight,
  showCurrent,
  onPick,
  book,
}: {
  trades: PastTrade[];
  loading: boolean;
  since: string;
  highlight: number | null;
  showCurrent: boolean;
  onPick: (index: number | null) => void;
  book: Book;
}) {
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-serif text-base">历史机会</h3>
        {loading ? <span className="text-xs text-muted">回看中…</span> : null}
      </div>
      {!loading && trades.length === 0 ? (
        <p className="mt-2 text-sm leading-6 text-muted">
          {book === "eve-adam"
            ? "这段前复权日线里没有扫到先圆底、再尖 V 的底部。"
            : "这段前复权日线里没有扫到完整的亚当夏娃。"}
        </p>
      ) : null}
      {trades.length > 0 ? (
        <p className="mt-2 text-sm leading-6 text-muted">
          {since ? `自 ${since} 起，` : ""}
          {historySummary(trades)}
        </p>
      ) : null}
      {trades.length > 0 || showCurrent ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {showCurrent ? (
            <button
              type="button"
              onClick={() => onPick(null)}
              className={
                highlight == null
                  ? "h-16 shrink-0 rounded-xl bg-fg px-3 text-left text-bg"
                  : "h-16 shrink-0 rounded-xl border border-line px-3 text-left text-fg"
              }
            >
              <span className="block text-xs opacity-70">现在</span>
              <span className="mt-1 block text-sm">当前走势</span>
            </button>
          ) : null}
          {trades.map((trade, index) => {
            const on = highlight === index;
            return (
              <button
                key={`${trade.signalDate}-${trade.pattern.eveIndex}`}
                type="button"
                onClick={() => onPick(index)}
                className={
                  on
                    ? "h-16 shrink-0 rounded-xl bg-fg px-3 text-left text-bg"
                    : "h-16 shrink-0 rounded-xl border border-line px-3 text-left text-fg"
                }
              >
                <span className={`block text-xs ${on ? "opacity-70" : "text-muted"}`}>{trade.signalDate}</span>
                <span className="mt-1 block text-sm">
                  {OUTCOME_LABEL[trade.outcome]}
                  <span className={`ml-2 tabular-nums ${on ? "" : tone(trade.returnPct)}`}>
                    {trade.outcome === "missed" ? "" : signedPct(trade.returnPct)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      <p className="mt-2 text-xs leading-5 text-muted">
        突破日收盘进场，之后 30 个交易日内先碰目标还是先碰止损。同一根 K 线都碰到，记为止损。
      </p>
    </div>
  );
}

function PastPlan({ trade }: { trade: PastTrade }) {
  const missed = trade.outcome === "missed";
  const rows = missed
    ? [
        ["夏娃", trade.signalDate],
        ["颈线", price(trade.pattern.neckline)],
        ["结果", "价格没有站上颈线"],
        ["评分", String(trade.pattern.score)],
      ]
    : [
        ["信号", trade.signalDate],
        ["入场", price(trade.pattern.entry)],
        ["止损", price(trade.pattern.stop)],
        ["目标", price(trade.pattern.target)],
        ["结果", OUTCOME_LABEL[trade.outcome]],
        ["收益", signedPct(trade.returnPct)],
        ["持有", `${trade.holdDays} 日`],
        ["离场", `${trade.exitDate} · ${price(trade.exitPrice)}`],
      ];
  return (
    <div className="rounded-xl border border-line p-3">
      <h3 className="font-serif text-base">{missed ? "未触发的形态" : "这次回测"}</h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-0.5 tabular-nums text-fg">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Plan({ hit, book = "adam-eve" }: { hit: ScanHit; book?: Book }) {
  const pattern = hit.pattern;
  if (!pattern) return null;
  const reverse = book === "eve-adam";
  const atMarket = Math.abs(pattern.entry - hit.price) / Math.max(hit.price, 0.01) < 0.004;
  const rows = [
    [
      "入场",
      pattern.stage === "forming"
        ? `颈线 ${price(pattern.entry)}`
        : reverse
          ? `突破 ${price(pattern.entry)}`
          : atMarket
            ? `现价 ${price(pattern.entry)}`
            : `突破 ${price(pattern.entry)}`,
    ],
    ["止损", `${price(pattern.stop)} · 两底较低者下方`],
    [
      "目标",
      reverse
        ? `${price(pattern.target)} · 至少一倍止损，跌幅半程更远则取半程`
        : `${price(pattern.target)} · 颈线加上形态高度`,
    ],
    ["盈亏比", ratio(pattern.rewardRisk)],
    ["底距", signedPct(pattern.lowGap).replace("+", "")],
    ["先前跌幅", signedPct(-pattern.priorDrop)],
    ["亚当宽度", `${pattern.adamWidth} 根`],
    ["夏娃宽度", `${pattern.eveWidth} 根`],
  ];
  return (
    <div className="rounded-xl border border-line p-3">
      <h3 className="font-serif text-base">交易计划</h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-0.5 tabular-nums text-fg">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs leading-5 text-muted">
        {reverse
          ? "盈亏比按突破当天算，不按现在的价格。浅底不再用那一点高度当目标。现价离目标已经近于止损的，标成延伸，不进可交易。"
          : "构筑阶段的入场价是颈线，不是现价。延伸阶段往往已经吃掉测量涨幅，盈亏比会变差。"}
      </p>
    </div>
  );
}

function Metrics({ hit }: { hit: ScanHit }) {
  const pattern = hit.pattern;
  const rows = [
    ["ATR 倍数", multiple(hit.atrMultipleFromMa), "收盘相对 20 日均线，以 ATR 计"],
    ["偏离均线", signedPct(hit.gainFromMaPct), "收盘相对 20 日均线"],
    ["ATR%", signedPct(hit.atrPct).replace("+", ""), `ATR ${price(hit.atr)}`],
    ["相对量能", `${ratio(pattern?.rvol ?? hit.rvol)}x`, pattern ? "突破日或最近一日 / 前 20 日" : "最近一日 / 前 20 日"],
    ["量能较均量", signedPct(hit.volVsAvg), "最近一根相对前 20 日"],
    ["60 日均线", price(hit.ma60), `20 日 ${price(hit.ma)}`],
  ];
  return (
    <div className="rounded-xl border border-line p-3">
      <h3 className="font-serif text-base">结构读数</h3>
      <dl className="mt-3 flex flex-col gap-3">
        {rows.map(([label, value, note]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <div>
              <dt className="text-sm text-fg">{label}</dt>
              <dd className="text-xs text-muted">{note}</dd>
            </div>
            <span className="tabular-nums text-sm text-fg">{value}</span>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Rules({ compact = false, book = "adam-eve" }: { compact?: boolean; book?: Book }) {
  const reverse = book === "eve-adam";
  return (
    <div className={compact ? "rounded-xl border border-line p-3" : "rounded-2xl bg-surface p-4 shadow-ring sm:p-5"}>
      <h2 className="font-serif text-xl">{compact ? "规则" : reverse ? "逆向在找什么" : "这套扫描在找什么"}</h2>
      {!compact ? (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          {reverse
            ? "先在底部走出一只宽碗，再来一根尖 V。碗是夏娃，针是起来的那一下。两段之间的高点是颈线。"
            : "亚当与夏娃是向上反转的双底。左边的底窄而尖，像一根针；右边的底宽而圆，像一只碗。中间反弹的高点连成颈线。"}
        </p>
      ) : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-sm text-fg">{reverse ? "夏娃在前" : "亚当"}</h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            {reverse
              ? "底部区间里的圆底。价格已经在低位来回，不是从高位一路扎下来的那根针。低点附近要有一段宽度。"
              : "下跌之后的尖底。附近只有很少几根 K 线贴着低点，低点相对左右邻居有明显下刺。"}
          </p>
        </div>
        <div>
          <h3 className="text-sm text-fg">{reverse ? "然后 V 起来" : "夏娃"}</h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            {reverse
              ? "圆底之后的尖底。它不该明显击穿夏娃。随后很少几根 K 线里，收盘要冲过区间高点。慢吞吞磨上去的不算。"
              : "出现在亚当之后。底部更宽，价格在低位来回，而不是单日长针。两个低点要接近，夏娃不该明显击穿亚当。"}
          </p>
        </div>
        <div>
          <h3 className="text-sm text-fg">颈线与进场</h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            颈线取两底之间的最高价。收盘价站上颈线才进场；之后再次靠近颈线且守住，记为回踩。止损放在两底较低者略下方。
          </p>
        </div>
        <div>
          <h3 className="text-sm text-fg">目标</h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            {reverse
              ? "不按浅底的那一点高度止盈。目标是跌下来这段的一半；如果那样还不够一倍止损，就把目标放到一倍止损处。现价离目标已经近于止损的，不再当新鲜买点。"
              : "测量涨幅等于颈线减去底部。价格已经远离颈线、或相对 20 日均线拉出太多 ATR，会标成延伸，不再当作新鲜买点。"}
          </p>
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-muted">
        {reverse ? "这一页和亚当夏娃分开扫描、分开回测。" : "前复权日线，红涨绿跌。"}
        规则扫描只描述形态，不是买卖指令，也不保证下一根 K 线。
      </p>
    </div>
  );
}
