import {
  Bar,
  Cell,
  ComposedChart,
  Customized,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Bar as Candle, Pattern } from "@/lib/pattern/adam-eve";
import { price } from "@/components/terminal/format";

type Row = Candle & { sma20: number | null; sma60: number | null };

type AxisMap = Record<string, { scale: (value: never) => number }>;

type LayerProps = {
  xAxisMap?: AxisMap;
  yAxisMap?: AxisMap;
  offset?: { left: number; top: number; width: number; height: number };
};

function withMovingAverages(bars: Candle[]): Row[] {
  return bars.map((bar, index) => {
    const mean = (period: number) => {
      if (index + 1 < period) return null;
      let sum = 0;
      for (let cursor = index - period + 1; cursor <= index; cursor += 1) sum += bars[cursor].close;
      return sum / period;
    };
    return { ...bar, sma20: mean(20), sma60: mean(60) };
  });
}

function Tip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: Row }>;
}) {
  if (!active || !payload?.[0]) return null;
  const row = payload[0].payload;
  const up = row.close >= row.open;
  return (
    <div className="rounded-lg bg-surface px-3 py-2 text-xs shadow-ring">
      <p className="text-muted">{row.date}</p>
      <p className={up ? "text-up" : "text-down"}>
        开 {price(row.open)}　收 {price(row.close)}
      </p>
      <p className="text-fg">
        高 {price(row.high)}　低 {price(row.low)}
      </p>
    </div>
  );
}

function CandleLayer(props: LayerProps & { rows: Row[]; pattern: Pattern | null; eveFirst: boolean }) {
  const xAxis = props.xAxisMap && Object.values(props.xAxisMap)[0];
  const yAxis = props.yAxisMap && Object.values(props.yAxisMap)[0];
  if (!xAxis || !yAxis || !props.offset || props.rows.length === 0) return null;
  const offset = props.offset;
  const body = Math.max(2, (offset.width / props.rows.length) * 0.56);

  return (
    <g>
      {props.rows.map((row, index) => {
        const cx = xAxis.scale(row.date as never);
        if (cx == null || Number.isNaN(cx)) return null;
        const up = row.close >= row.open;
        const color = up ? "var(--color-up)" : "var(--color-down)";
        const yHigh = yAxis.scale(row.high as never);
        const yLow = yAxis.scale(row.low as never);
        const yOpen = yAxis.scale(row.open as never);
        const yClose = yAxis.scale(row.close as never);
        const top = Math.min(yOpen, yClose);
        const height = Math.max(1, Math.abs(yClose - yOpen));
        const mark =
          props.pattern?.adamIndex === index
            ? props.eveFirst
              ? "V"
              : "亚当"
            : props.pattern?.eveIndex === index
              ? "夏娃"
              : props.pattern?.breakoutIndex === index
                ? props.eveFirst
                  ? "起来"
                  : "突破"
                : props.pattern?.retestIndex === index
                  ? "回踩"
                  : null;
        const labelY = Math.max(offset.top + 12, yHigh - 16);
        const plate = mark ? mark.length * 12 + 8 : 0;
        return (
          <g key={row.date}>
            <line x1={cx} x2={cx} y1={yHigh} y2={yLow} stroke={color} strokeWidth={1} />
            <rect x={cx - body / 2} y={top} width={body} height={height} fill={color} />
            {mark ? (
              <g>
                <rect
                  x={cx - plate / 2}
                  y={labelY - 11}
                  width={plate}
                  height={15}
                  rx={2}
                  fill="var(--color-bg)"
                />
                <text
                  x={cx}
                  y={labelY}
                  textAnchor="middle"
                  fill="var(--color-fg)"
                  fontSize={11}
                  fontFamily="var(--font-serif)"
                >
                  {mark}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

export function PriceChart({
  bars,
  pattern,
  eveFirst = false,
}: {
  bars: Candle[];
  pattern: Pattern | null;
  eveFirst?: boolean;
}) {
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
  const pad = (max - min) * 0.08 || max * 0.02;
  const domain: [number, number] = [min - pad, max + pad * 1.4];
  const targetInside = pattern != null && pattern.target <= pattern.neckline * 1.2;

  return (
    <div className="flex flex-col gap-1">
      <div className="h-72 sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 12, right: 4, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="date"
              tickFormatter={(value: string) => value.slice(5)}
              minTickGap={28}
              tick={{ fill: "var(--color-muted)", fontSize: 11 }}
              axisLine={{ stroke: "var(--color-line)" }}
              tickLine={false}
            />
            <YAxis
              orientation="right"
              domain={domain}
              width={52}
              tickFormatter={(value: number) => value.toFixed(2)}
              tick={{ fill: "var(--color-muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<Tip />} cursor={{ stroke: "var(--color-line)" }} />
            <Line
              type="monotone"
              dataKey="sma20"
              stroke="var(--color-fg)"
              strokeWidth={1.25}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="sma60"
              stroke="var(--color-muted)"
              strokeWidth={1}
              strokeDasharray="4 4"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            {pattern ? (
              <ReferenceLine
                y={pattern.neckline}
                stroke="var(--color-fg)"
                strokeDasharray="4 3"
                label={{
                  value: "颈线",
                  fill: "var(--color-fg)",
                  fontSize: 11,
                  position: "insideTopLeft",
                }}
              />
            ) : null}
            {pattern ? (
              <ReferenceLine
                y={pattern.stop}
                stroke="var(--color-down)"
                strokeDasharray="2 3"
                label={{
                  value: "止损",
                  fill: "var(--color-down)",
                  fontSize: 11,
                  position: "insideBottomLeft",
                }}
              />
            ) : null}
            {pattern && targetInside ? (
              <ReferenceLine
                y={pattern.target}
                stroke="var(--color-up)"
                strokeDasharray="2 3"
                label={{
                  value: "目标",
                  fill: "var(--color-up)",
                  fontSize: 11,
                  position: "insideTopLeft",
                }}
              />
            ) : null}
            <Customized component={(layer: LayerProps) => <CandleLayer {...layer} rows={rows} pattern={pattern} eveFirst={eveFirst} />} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="h-16">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
            <XAxis dataKey="date" hide />
            <YAxis orientation="right" width={52} hide domain={[0, (dataMax: number) => dataMax * 3.2]} />
            <Bar dataKey="volume" isAnimationActive={false} barSize={3}>
              {rows.map((row) => (
                <Cell
                  key={row.date}
                  fill={row.close >= row.open ? "var(--color-up)" : "var(--color-down)"}
                />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-muted">
        <span>红涨绿跌</span>
        <span>实线 20 日</span>
        <span>虚线 60 日</span>
        {pattern && !targetInside ? <span>目标高于可视区，见右侧计划</span> : null}
      </div>
    </div>
  );
}
