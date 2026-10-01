# Strategy V2 validation — 2026-10-01

Base: `bd7e5c5f366996435033b7ef23881bfdf8be688f`.

## Verified

- `npm test`: 207 script tests plus 55 auth/app-data tests passed (262 total).
- New strategy regression suite: 12 tests, included above. Covers prefix-invariant signals with nonempty deterministic data, next-open execution, T+1, gap-stop fills, limit-down exit deferral, daily floating drawdown, risk-sized positions, unclosed trade statistics, intraday-bar exclusion, raw-price turnover, failed history chunks, next-day trailing-stop activation, and signal-day market regime.
- `npm run typecheck`: passed.
- `npm run build`: passed; no database configuration was needed because strategy state is in memory.
- Live provider probe: Tencent supplied 170 completed daily bars for 600519 through 2026-09-30; Sina supplied current ranked stock rows. No Tushare credential was used.
- Real-data end-to-end run: current top-10 pool, Adam/Eve, short span. 9 symbols processed and 1 rejected for insufficient completed history (688825). 28 executable candidates, 20 closed trades and 1 open position. This small integration check is NOT an efficacy or out-of-sample test; no new headline performance claim is made.
- Original template title tests accidentally read the project's actual OG identity/card. Test fixtures now explicitly use an isolated empty directory; product branding behavior is unchanged.
- Dependency lock repaired so installation no longer fails on missing nested AJV dependencies.

## Not verified

- Browser visual and interaction QA: Chromium/headless-shell downloads returned invalid ZIP files. The local development server also hit `uv_interface_addresses` permission errors. Production compilation passed, but this does not establish browser rendering, hydration, or live deployment health.
- Full 200/500-name runs, twenty-year runs, parameter robustness, historical point-in-time universe, and out-of-sample performance have not been validated.
- No live trading, brokerage integration, or new website deployment was performed.

## Remaining modeling limits

Current-universe selection and survival biases remain. Historical ST changes, all special limit rules, precise turnover, per-era fees, whole-lot sizing, and order-book capacity are not reconstructed. Missing trading dates may be suspensions or provider gaps; carried marks are not proof of a tradable price. Split-adjusted limit calculations are approximate. Signals are now causal in the supplied price series, not a claim that the supplied series is a full point-in-time dataset.

A 0.5% planned stop risk is a sizing input, not a loss guarantee. New 3-ATR / 120-session trend exits are research defaults compared against fixed-target / 30-session exits, not optimized or proven parameters.
