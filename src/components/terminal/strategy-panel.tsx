import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import type { StrategyReport } from "@/lib/market/scan";
import { ratio, signedPct } from "@/components/terminal/format";

function tone(value: number) {
  if (value > 0.0005) return "text-up";
  if (value < -0.0005) return "text-down";
  return "text-muted";
}

export function StrategyPanel({
  report,
  loading,
  error,
  onRetry,
  title = "策略收益",
  pending = "成交额前 200 只，近两年多，按同一套进场和出场规则复利。",
  rule,
  sample = "成交额前",
  span = "2y",
  onSpan,
}: {
  report: StrategyReport | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  title?: string;
  pending?: string;
  rule?: string;
  sample?: string;
  span?: "2y" | "20y";
  onSpan?: (span: "2y" | "20y") => void;
}) {
  return (
    <section className="order-0 rounded-2xl bg-surface p-3 shadow-ring sm:p-4 lg:col-span-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl">{title}</h2>
          <p className="mt-1 text-xs text-muted">
            {report
              ? `${report.from} 至 ${report.to}${report.signalFrom ? ` · 首笔信号 ${report.signalFrom}` : ""} · ${sample} ${report.universeSize} 只 · 扣费后`
              : pending}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onSpan ? (
            <>
              <button
                type="button"
                onClick={() => onSpan("2y")}
                className={span === "2y" ? "h-10 rounded-full bg-fg px-3 text-sm text-bg" : "h-10 rounded-full px-3 text-sm text-muted"}
              >
                近两年
              </button>
              <button
                type="button"
                onClick={() => onSpan("20y")}
                className={span === "20y" ? "h-10 rounded-full bg-fg px-3 text-sm text-bg" : "h-10 rounded-full px-3 text-sm text-muted"}
              >
                过去二十年
              </button>
            </>
          ) : null}
          {report ? (
            <button type="button" onClick={onRetry} className="h-10 rounded-lg px-3 text-sm text-muted">
              重新计算
            </button>
          ) : null}
        </div>
      </div>

      {loading && !report ? (
        <div className="mt-4 h-28 animate-pulse rounded-xl bg-bg motion-reduce:animate-none" />
      ) : null}
      {error ? <p className="mt-3 text-sm text-up">{error}</p> : null}

      {report ? (
        <>
          <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <p className="text-xs text-muted">组合收益</p>
              <p className={`font-serif text-4xl tabular-nums ${tone(report.totalReturn)}`}>
                {signedPct(report.totalReturn)}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              <Stat label="年化" value={signedPct(report.annualized)} className={tone(report.annualized)} />
              <Stat label="最大回撤" value={signedPct(report.maxDrawdown)} className="text-down" />
              <Stat label="胜率" value={signedPct(report.winRate).replace("+", "")} />
              <Stat label="笔均净收益" value={signedPct(report.avgNet)} className={tone(report.avgNet)} />
              <Stat label="成交笔数" value={String(report.taken)} />
              <Stat label="盈亏比" value={ratio(report.payoff)} />
              <Stat label="可买信号" value={String(report.signals)} />
              <Stat label="弱市少做" value={String(report.skippedRegime)} />
            </dl>
          </div>

          <div className="mt-3 h-36">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={report.curve}>
                <YAxis
                  domain={["auto", "auto"]}
                  width={46}
                  tickFormatter={(value: number) => value.toFixed(2)}
                  tick={{ fill: "var(--color-muted)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const equity = Number(payload[0].value);
                    return (
                      <div className="rounded-lg bg-surface px-2 py-1 text-xs shadow-ring">
                        <p className="text-muted">{label}</p>
                        <p className={`tabular-nums ${tone(equity - 1)}`}>{signedPct(equity - 1)}</p>
                      </div>
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="equity"
                  stroke="var(--color-fg)"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <p className="mt-2 text-xs leading-5 text-muted">
            {rule ? `${rule} ` : ""}
            最多同时 8 笔，每笔用当时净值的 12.5%。上证或沪深300收在 20 日线下方超过 3% 且均线向下时，只做评分不低于
            76 的信号，持仓上限降到 3 笔，而且当天只新开 1 笔。这段样本里这样的弱市有 {report.riskOffDays} 个交易日。费用按佣金万 2.5、卖出印花税万 5、滑点单边 0.1%。回撤按平仓净值，不含持仓途中的波动，也没模拟一字跌停卖不出。样本是现在仍在交易的股票，不含已退市。
            {report.rejected.amount || report.rejected.limit
              ? ` 另有 ${report.rejected.amount} 笔因成交额、${report.rejected.limit} 笔因一字涨停没有买入。`
              : ""}
            {report.failed ? ` ${report.failed} 只日线没读到。` : ""}
          </p>
        </>
      ) : null}
      {loading && report ? <p className="mt-2 text-xs text-muted">正在重算…</p> : null}
    </section>
  );
}

function Stat({ label, value, className = "text-fg" }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-0.5 tabular-nums ${className}`}>{value}</dd>
    </div>
  );
}
