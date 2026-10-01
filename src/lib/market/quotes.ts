import type { Bar } from "@/lib/pattern/adam-eve";

const SINA =
  "https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData";
const TENCENT = "https://proxy.finance.qq.com/ifzqgtimg/appstock/app/newfqkline/get";
const SINA_KLINE =
  "https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData";

const klineCache = new Map<string, { at: number; bars: Bar[]; name: string }>();
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

export async function loadUniverse(node: string, size: number, page = 1): Promise<QuoteRow[]> {
  const url = `${SINA}?page=${page}&num=${size}&sort=amount&asc=0&node=${node}`;
  const rows = (await fetchJson(url, "https://finance.sina.com.cn")) as QuoteRow[];
  if (!Array.isArray(rows)) throw new Error("股票列表格式异常");
  return rows;
}

function amountYuan(close: number, volume: number, quoted: number | undefined, unit: "lot" | "share") {
  if (quoted != null && Number.isFinite(quoted) && quoted > 0) return quoted * 10000;
  const shares = unit === "lot" ? volume * 100 : volume;
  return shares * close;
}

function parseTencentRows(rows: string[][] | undefined): Bar[] {
  if (!rows?.length) return [];
  return rows
    .map((row) => {
      const close = Number(row[2]);
      const volume = Number(row[5]);
      return {
        date: String(row[0]),
        open: Number(row[1]),
        close,
        high: Number(row[3]),
        low: Number(row[4]),
        volume,
        amount: amountYuan(close, volume, Number(row[8]), "lot"),
      };
    })
    .filter((bar) => bar.date && bar.close > 0 && bar.high > 0 && bar.low > 0);
}

function parseSinaRows(rows: Array<Record<string, string>> | undefined): Bar[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const close = Number(row.close);
      const volume = Number(row.volume);
      return {
        date: String(row.day),
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close,
        volume,
        amount: amountYuan(close, volume, undefined, "share"),
      };
    })
    .filter((bar) => bar.date && bar.close > 0 && bar.high > 0 && bar.low > 0);
}

export async function loadSymbol(symbol: string, count: number): Promise<Bar[]> {
  const url = `${TENCENT}?param=${symbol},day,,,${count},qfq`;
  const json = (await fetchJson(url, "https://gu.qq.com/")) as {
    data?: Record<string, { qfqday?: string[][]; day?: string[][] }>;
  };
  const pack = json.data?.[symbol];
  return parseTencentRows(pack?.qfqday?.length ? pack.qfqday : pack?.day);
}

const LONG_ENDS = ["2009-03-31", "2011-09-30", "2014-03-31", "2016-09-30", "2019-03-29", "2021-09-30", "2024-03-29", "2026-12-31"];

async function loadWindow(symbol: string, end: string): Promise<Bar[]> {
  try {
    const url = `${TENCENT}?param=${symbol},day,,${end},800,qfq`;
    const json = (await fetchJson(url, "https://gu.qq.com/", 20000)) as {
      data?: Record<string, { qfqday?: string[][]; day?: string[][] }>;
    };
    const pack = json.data?.[symbol];
    return parseTencentRows(pack?.qfqday?.length ? pack.qfqday : pack?.day);
  } catch {
    return [];
  }
}

export async function loadLongSymbol(symbol: string, start = "2006-09-23"): Promise<Bar[]> {
  const chunks = await mapPool(LONG_ENDS, 4, (end) => loadWindow(symbol, end));
  const byDate = new Map<string, Bar>();
  for (const bar of chunks.flat()) {
    if (bar.date >= start) byDate.set(bar.date, bar);
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export async function loadLongBars(code: string, start = "2006-09-23"): Promise<{ bars: Bar[]; name: string }> {
  const cacheKey = `${code}:long:${start}`;
  const cached = klineCache.get(cacheKey);
  if (cached && Date.now() - cached.at < KLINE_TTL) return cached;
  const bars = await loadLongSymbol(symbolOf(code), start);
  const value = { at: Date.now(), bars, name: code };
  klineCache.set(cacheKey, value);
  return value;
}

export async function loadBars(code: string, count = 170): Promise<{ bars: Bar[]; name: string }> {
  const cacheKey = `${code}:${count}`;
  const cached = klineCache.get(cacheKey);
  if (cached && Date.now() - cached.at < KLINE_TTL) return cached;
  const symbol = symbolOf(code);
  let bars: Bar[] = [];
  let name = code;
  try {
    const url = `${TENCENT}?param=${symbol},day,,,${count},qfq`;
    const json = (await fetchJson(url, "https://gu.qq.com/")) as {
      data?: Record<string, { qfqday?: string[][]; day?: string[][]; qt?: Record<string, string[]> }>;
    };
    const pack = json.data?.[symbol];
    bars = parseTencentRows(pack?.qfqday?.length ? pack.qfqday : pack?.day);
    const quoted = pack?.qt?.[symbol];
    if (quoted?.[1]) name = cleanName(quoted[1]);
  } catch {
    bars = [];
  }
  if (bars.length < 70) {
    const url = `${SINA_KLINE}?symbol=${symbol}&scale=240&ma=no&datalen=${count}`;
    const rows = (await fetchJson(url, "https://finance.sina.com.cn")) as Array<Record<string, string>>;
    const fallback = parseSinaRows(rows);
    if (fallback.length > bars.length) bars = fallback;
  }
  if (bars.length < 70) throw new Error(`${code} 日线不足`);
  const entry = { at: Date.now(), bars, name };
  klineCache.set(cacheKey, entry);
  return entry;
}

export async function mapPool<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
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
