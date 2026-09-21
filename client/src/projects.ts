export const PROJECTS = ["Connect", "Force"] as const;
export type ProjectName = (typeof PROJECTS)[number];

export function projectOf(value?: string | null): ProjectName {
  return value === "Force" ? "Force" : "Connect";
}

export function pctOrNA(part?: number | null, total?: number | null) {
  const done = Number(part || 0);
  const scope = Number(total || 0);
  if (!scope) return done > 0 ? "100%" : "0%";
  return `${Math.round((done / scope) * 1000) / 10}%`;
}

export function deltaPct(current: number, previous: number) {
  if (!previous) return previous === current ? "0%" : "N/A";
  return `${Math.round(((current - previous) / previous) * 1000) / 10}%`;
}

export function signed(value?: number | null) {
  const n = Number(value || 0);
  return n > 0 ? `+${n}` : String(n);
}

export function na(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "N/A";
  return value;
}
