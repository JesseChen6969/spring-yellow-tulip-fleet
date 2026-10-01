import type { Bar } from "@/lib/pattern/adam-eve";

const SINA =
  "https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData";
const TENCENT =
  "https://proxy.finance.qq.com/ifzqgtimg/appstock/app/newfqkline/get";
export type QuotePack = {
  at: number;
  bars: Bar[];
  name: string;
  source: string;
};
const klineCache = new Map<string, QuotePack>();

/** Daily strategy uses completed sessions only; 16:00 CST allows provider lag. */
export function completedBars(bars: Bar[], now = new Date()): Bar[] {
  const china = new Date(now.getTime() + 8 * 3600000);
  const today = china.toISOString().slice(0, 10);
  return bars.filter(
    (bar) =>
      bar.date < today || (bar.date === today && china.getUTCHours() >= 16),
  );
}

const KLINE_TTL = 8 * 60 * 1000;

export type QuoteRow = {
  code: string;
  name: string;
  amount?: number;
};

export function symbolOf(code: string) {
  if (code.startsWith("6") || code.startsWith("9")) return `sh${code}`;
  if (code.startsWith("4") || code.startsWith("8")) return `bj${code}`;
  return `sz${code}`;
}

export function cleanName(name: string) {
  return name.replace(/\s+/g, "").trim();
}

async function fetchJson(url: string, referer: string, timeout = 12000) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Referer: referer,
          Accept: "application/json,text/plain,*/*",
        },
        signal: AbortSignal.timeout(timeout),
      });
      if (!response.ok) throw new Error(`行情响应 ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 280 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("行情源没有回应");
}

export async function loadUniverse(
  node: string,
  size: number,
  page = 1,
): Promise<QuoteRow[]> {
  const url = `${SINA}?page=${page}&num=${size}&sort=amount&asc=0&node=${node}`;
  const rows = (await fetchJson(
    url,
    "https://finance.sina.com.cn",
  )) as QuoteRow[];
  if (!Array.isArray(rows)) throw new Error("股票列表格式异常");
  return rows;
}

export function parseTencentRows(rows: string[][] | undefined): Bar[] {
  if (!rows?.length) return [];
  const bars = rows
    .map((row) => {
      const close = Number(row[2]);
      const volume = Number(row[5]);
      return {
        date: String(row[0]).slice(0, 10),
        open: Number(row[1]),
        close,
        high: Number(row[3]),
        low: Number(row[4]),
        volume,
        amount: 0, // assigned using the unadjusted series, never a guessed row[8] field
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const dates = new Set<string>();
  for (const bar of bars) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(bar.date) ||
      dates.has(bar.date) ||
      ![bar.open, bar.high, bar.low, bar.close, bar.volume].every(
        Number.isFinite,
      ) ||
      bar.low <= 0 ||
      bar.open <= 0 ||
      bar.close <= 0 ||
      bar.high < Math.max(bar.open, bar.close, bar.low) ||
      bar.low > Math.min(bar.open, bar.close) ||
      bar.volume < 0
    ) {
      throw new Error(`日线格式异常或日期重复：${bar.date}`);
    }
    dates.add(bar.date);
  }
  return bars;
}

type TencentPack = {
  qfqday?: string[][];
  day?: string[][];
  qt?: Record<string, string[]>;
};
async function requestSeries(
  symbol: string,
  count: number,
  end = "",
  adjusted = true,
) {
  const url = `${TENCENT}?param=${symbol},day,,${end},${count},${adjusted ? "qfq" : ""}`;
  const json = (await fetchJson(url, "https://gu.qq.com/", 20000)) as {
    data?: Record<string, TencentPack>;
  };
  const pack = json.data?.[symbol];
  if (!pack) throw new Error(`${symbol} 日线响应缺少股票数据`);
  return pack;
}
export async function loadSymbol(
  symbol: string,
  count: number,
): Promise<Bar[]> {
  const pack = await requestSeries(symbol, count);
  return completedBars(
    parseTencentRows(pack.qfqday?.length ? pack.qfqday : pack.day),
  );
}

export function withRawAmounts(adjusted: Bar[], raw: Bar[]): Bar[] {
  const byDate = new Map(raw.map((bar) => [bar.date, bar]));
  return adjusted.map((bar) => {
    const original = byDate.get(bar.date);
    if (!original) throw new Error(`未复权日线缺失：${bar.date}`);
    return { ...bar, amount: original.close * original.volume * 100 };
  });
}

async function loadWindow(symbol: string, end: string): Promise<Bar[]> {
  // Failure is propagated: a missing historical chunk is not an empty market.
  const [adjusted, raw] = await Promise.all([
    requestSeries(symbol, 800, end),
    requestSeries(symbol, 800, end, false),
  ]);
  return completedBars(
    withRawAmounts(
      parseTencentRows(
        adjusted.qfqday?.length ? adjusted.qfqday : adjusted.day,
      ),
      parseTencentRows(raw.day),
    ),
  );
}

export async function loadLongSymbol(
  symbol: string,
  start = "2006-09-23",
): Promise<Bar[]> {
  const year = new Date().getUTCFullYear();
  const ends: string[] = [];
  for (let y = Number(start.slice(0, 4)) + 2; y < year; y += 2)
    ends.push(`${y}-12-31`);
  ends.push(`${year}-12-31`);
  const chunks = await mapPool(ends, 2, (end) => loadWindow(symbol, end));
  const byDate = new Map<string, Bar>();
  let started = false;
  for (const chunk of chunks) {
    if (started && !chunk.length)
      throw new Error(`${symbol} 历史分段为空，拒绝拼接`);
    if (chunk.length) started = true;
    for (const bar of chunk) {
      const old = byDate.get(bar.date);
      if (old && Math.abs(old.close / bar.close - 1) > 0.002) {
        throw new Error(`${symbol} 历史分段复权口径不一致：${bar.date}`);
      }
      if (bar.date >= start) byDate.set(bar.date, bar);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function loadLongBars(
  code: string,
  start = "2006-09-23",
  force = false,
): Promise<QuotePack> {
  const key = `${code}:long:${start}`;
  const cached = klineCache.get(key);
  if (!force && cached && Date.now() - cached.at < KLINE_TTL) return cached;
  const bars = await loadLongSymbol(symbolOf(code), start);
  const value = {
    at: Date.now(),
    bars,
    name: code,
    source: "腾讯前复权日线 / 未复权成交额近似",
  };
  klineCache.set(key, value);
  return value;
}

export async function loadBars(
  code: string,
  count = 170,
  force = false,
): Promise<QuotePack> {
  const key = `${code}:${count}`;
  const cached = klineCache.get(key);
  if (!force && cached && Date.now() - cached.at < KLINE_TTL) return cached;
  const symbol = symbolOf(code);
  const [pack, raw] = await Promise.all([
    requestSeries(symbol, count),
    requestSeries(symbol, count, "", false),
  ]);
  const bars = completedBars(
    withRawAmounts(
      parseTencentRows(pack.qfqday?.length ? pack.qfqday : pack.day),
      parseTencentRows(raw.day),
    ),
  );
  if (bars.length < 70) throw new Error(`${code} 已完成日线不足`);
  const value = {
    at: Date.now(),
    bars,
    name: cleanName(pack.qt?.[symbol]?.[1] || code),
    source: "腾讯前复权日线 / 未复权成交额近似",
  };
  // Do not silently substitute unadjusted Sina bars into an adjusted strategy.
  klineCache.set(key, value);
  return value;
}

export async function mapPool<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
) {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}
