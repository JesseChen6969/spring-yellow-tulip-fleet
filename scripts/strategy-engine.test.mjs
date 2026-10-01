import "./strategy-test-loader.mjs";
import test from "node:test";
import assert from "node:assert/strict";
const { settleTrade, confirmedSignals, backtestAdamEve, backtestEveAdam } =
  await import("../src/lib/pattern/adam-eve.ts");
const { simulateBook } = await import("../src/lib/market/strategy.ts");
const { completedBars, withRawAmounts, loadLongSymbol } =
  await import("../src/lib/market/quotes.ts");
const { netReturn } = await import("../src/lib/market/gates.ts");
const bar = (date, close = 100, overrides = {}) => ({
  date,
  open: close,
  close,
  high: close + 1,
  low: close - 1,
  volume: 100000,
  amount: 1e9,
  ...overrides,
});
const pattern = {
  signalIndex: 0,
  breakoutIndex: 0,
  stop: 90,
  target: 120,
  score: 80,
};

test("next-open entry, T+1, and a gap through the stop fill at the executable open", () => {
  const bars = [
    bar("2026-01-01"),
    bar("2026-01-02", 100, { low: 85 }),
    bar("2026-01-05", 80),
  ];
  const t = settleTrade(bars, pattern, "fixed");
  assert.equal(t.entryDate, "2026-01-02");
  assert.equal(t.exitDate, "2026-01-05");
  assert.equal(t.exitPrice, 80);
  assert.equal(t.outcome, "stop");
});
test("same-bar stop and target is conservative; gap-up does not fill at yesterday close", () => {
  const t = settleTrade(
    [
      bar("2026-01-01"),
      bar("2026-01-02", 105),
      bar("2026-01-05", 100, { low: 89, high: 125 }),
    ],
    pattern,
    "fixed",
  );
  assert.equal(t.pattern.entry, 105);
  assert.equal(t.exitPrice, 90);
});
test("one-word limit-down postpones exit rather than inventing a stop fill", () => {
  const t = settleTrade(
    [
      bar("2026-01-01"),
      bar("2026-01-02"),
      bar("2026-01-05", 90, { high: 90, low: 90 }),
      bar("2026-01-06", 88),
    ],
    pattern,
    "fixed",
    "600001",
  );
  assert.equal(t.exitDate, "2026-01-06");
  assert.equal(t.exitPrice, 88);
});
test("unfilled last-day signals do not become fabricated trades", () => {
  assert.equal(settleTrade([bar("2026-01-01")], pattern).outcome, "missed");
});
test("daily drawdown includes floating losses; open trades do not count as wins", () => {
  const trade = {
    code: "A",
    signalDate: "2026-01-01",
    entryDate: "2026-01-02",
    exitDate: "2026-01-06",
    score: 80,
    riskPct: 0.05,
    gross: 0,
    net: netReturn(0),
    open: true,
    marks: [
      { date: "2026-01-02", gross: 0 },
      { date: "2026-01-05", gross: -0.5 },
      { date: "2026-01-06", gross: 0 },
    ],
  };
  const stats = simulateBook([trade], {}, [
    "2026-01-01",
    "2026-01-02",
    "2026-01-05",
    "2026-01-06",
  ]);
  assert.ok(stats.maxDrawdown < -0.04);
  assert.equal(stats.closed, 0);
  assert.equal(stats.winRate, 0);
  assert.equal(stats.open, 1);
});
test("risk budget allocates less capital to a wider stop", () => {
  const make = (riskPct) =>
    simulateBook(
      [
        {
          code: "A",
          signalDate: "2026-01-01",
          entryDate: "2026-01-02",
          exitDate: "2026-01-05",
          score: 80,
          riskPct,
          gross: 0.1,
          net: netReturn(0.1),
          open: false,
          marks: [],
        },
      ],
      {},
      ["2026-01-01", "2026-01-02", "2026-01-05"],
    );
  assert.ok(make(0.05).totalReturn > make(0.15).totalReturn * 2);
});
test("completed daily bars exclude intraday quotes and future dates", () => {
  const bars = [bar("2026-09-29"), bar("2026-09-30"), bar("2026-10-01")];
  assert.equal(completedBars(bars, new Date("2026-09-30T06:00:00Z")).length, 1);
  assert.equal(completedBars(bars, new Date("2026-09-30T08:00:00Z")).length, 2);
});
test("turnover uses raw prices; missing raw dates are a hard error", () => {
  assert.equal(
    withRawAmounts([bar("2026-01-01", 50)], [bar("2026-01-01", 100)])[0].amount,
    1e9,
  );
  assert.throws(
    () => withRawAmounts([bar("2026-01-01")], []),
    /未复权日线缺失/,
  );
});
// Seeded, multi-regime prices plus deliberate Adam/Eve basins exercise nonempty signals.
function fixture() {
  let state = 42,
    price = 100;
  return Array.from({ length: 850 }, (_, i) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    price *= 1 + (state / 2 ** 32 - 0.49) * 0.07;
    const date = new Date(Date.UTC(2020, 0, i + 1)).toISOString().slice(0, 10);
    return bar(date, price, { high: price * 1.015, low: price * 0.98 });
  });
}
test("signals are prefix-invariant and scores never change after future bars arrive", () => {
  const bars = fixture();
  let count = 0;
  for (const book of ["adam-eve", "eve-adam"]) {
    const full = confirmedSignals(bars, book);
    count += full.length;
    for (const end of [250, 450, 650]) {
      assert.deepEqual(
        confirmedSignals(bars.slice(0, end), book),
        full.filter((p) => p.signalIndex < end),
      );
    }
    const trades = (book === "adam-eve" ? backtestAdamEve : backtestEveAdam)(
      bars,
    );
    for (const t of trades)
      if (t.entryDate) assert.ok(t.entryDate > t.signalDate);
  }
  assert.ok(count > 0, "fixture must actually generate signals");
});
test("failed historical segments propagate rather than silently disappear", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ data: {} }),
  });
  try {
    await assert.rejects(loadLongSymbol("sh600001"), /缺少股票数据/);
  } finally {
    globalThis.fetch = original;
  }
});

test("today high cannot tighten a stop retroactively inside the same bar", () => {
  const bars = Array.from({ length: 22 }, (_, i) =>
    bar(`2026-01-${String(i + 1).padStart(2, "0")}`, 100),
  );
  bars[20] = bar("2026-01-21", 100, { high: 130, low: 97 });
  const t = settleTrade(
    bars,
    { ...pattern, signalIndex: 18, breakoutIndex: 18 },
    "trend",
  );
  assert.equal(t.exitDate, "2026-01-22");
  assert.equal(t.exitPrice, 100);
  assert.equal(t.outcome, "stop");
});
test("regime decisions use signal-day data, never entry-day close", () => {
  const t = {
    code: "A",
    signalDate: "2026-01-01",
    entryDate: "2026-01-02",
    exitDate: "2026-01-03",
    score: 50,
    riskPct: 0.05,
    gross: 0.1,
    net: netReturn(0.1),
    open: false,
    marks: [],
  };
  assert.equal(
    simulateBook([t], { "2026-01-02": true }, [
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
    ]).taken,
    1,
  );
  assert.equal(
    simulateBook([t], { "2026-01-01": true }, [
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
    ]).taken,
    0,
  );
});
