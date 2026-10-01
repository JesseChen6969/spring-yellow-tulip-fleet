export function signedPct(value: number, digits = 2) {
  if (!Number.isFinite(value)) return "—";
  const scaled = value * 100;
  const sign = scaled > 0 ? "+" : "";
  return `${sign}${scaled.toFixed(digits)}%`;
}

export function price(value: number) {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

export function amountYi(yuan: number) {
  if (!yuan) return "—";
  const yi = yuan / 1e8;
  if (yi >= 100) return `${yi.toFixed(0)}亿`;
  return `${yi.toFixed(1)}亿`;
}

export function multiple(value: number) {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

export function ratio(value: number) {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

export const BOARD_LABEL = {
  main: "主板",
  chinext: "创业板",
  star: "科创板",
  other: "其他",
} as const;
