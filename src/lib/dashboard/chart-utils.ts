// Shared chart helpers: nice ticks, color palettes, formatters.

/**
 * Round a number to 3 decimal places — used for every value that ends up in
 * an SVG attribute or an inline CSS dimension. This guarantees deterministic
 * string output across SSR/client, since Math.cos/Math.sin and other FP
 * operations may diverge by 1 ULP between V8 (Node) and the browser engine,
 * producing hydration mismatches on full-precision numbers like
 * `56.07695154586739`.
 */
export function r3(n: number): number {
  return Number(n.toFixed(3));
}

export function niceTicks(max: number, targetTicks = 4): number[] {
  if (max <= 0) return [0, 1];
  if (max <= 1) return [0, 1];
  const step = niceStep(max / targetTicks);
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) out.push(v);
  return out;
}

function niceStep(roughStep: number): number {
  const pow10 = Math.pow(10, Math.floor(Math.log10(Math.max(roughStep, 1))));
  const norm = roughStep / pow10;
  let nice: number;
  if (norm <= 1) nice = 1;
  else if (norm <= 2) nice = 2;
  else if (norm <= 5) nice = 5;
  else nice = 10;
  return nice * pow10;
}

// Status palette (ordered from "newest in funnel" to "completed").
// Light → dark green = early stages → final stage.
export const STATUS_PALETTE = [
  "#5CBFAF", // mint — entering funnel
  "#1A8B80", // teal
  "#0D6F65", // institutional
  "#2F7D46", // chart green
  "#044C45", // petrol — final
];

// Generic categorical palette for damage types, origins, destinations, etc.
export const CATEGORICAL_PALETTE = [
  "#0D6F65",
  "#1A8B80",
  "#2F7D46",
  "#5CBFAF",
  "#9BBC78",
  "#4EA3D9",
  "#D7A63A",
  "#C95A5A",
  "#044C45",
  "#083833",
  "#6B756F",
];

export function pickStatusColor(index: number, total: number): string {
  if (total <= 1) return STATUS_PALETTE[2];
  // Interpolate across the status palette range
  const ratio = total - 1 === 0 ? 0 : index / (total - 1);
  const palette = STATUS_PALETTE;
  const pos = ratio * (palette.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, palette.length - 1);
  const f = pos - lo;
  return mix(palette[lo], palette[hi], f);
}

export function pickCategoricalColor(index: number): string {
  return CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length];
}

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export const CHART_COLORS = {
  grid: "#EAF1EC",
  axis: "#9AA59F",
  text: "#6B756F",
  textStrong: "#1C2A24",
  border: "#DDE7DE",
  cardBg: "#FFFFFF",
};

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const BRL_COMPACT = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function fmtCurrency(value: number): string {
  return BRL.format(value);
}

export function fmtCurrencyCompact(value: number): string {
  return BRL_COMPACT.format(value);
}

export function fmtInt(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function fmtPct(numerator: number, denominator: number, digits = 0): string {
  if (denominator <= 0) return "0%";
  return `${((numerator / denominator) * 100).toFixed(digits)}%`;
}
