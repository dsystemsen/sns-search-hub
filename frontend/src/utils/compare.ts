import type { CompetitorCompare } from "../api/competitors";

export type CompareChartRow = { date: string } & Record<string, number | string>;

export function mergeCompareSeries(compare: CompetitorCompare): CompareChartRow[] {
  const map = new Map<string, CompareChartRow>();
  const push = (key: string, points: { date: string; subscribers: number }[]) => {
    for (const p of points) {
      const row = map.get(p.date) ?? { date: p.date };
      row[key] = p.subscribers;
      map.set(p.date, row);
    }
  };
  if (compare.own) push("自社", compare.own.points);
  for (const c of compare.competitors) push(c.name, c.points);
  return Array.from(map.values()).sort((a, b) =>
    String(a.date) < String(b.date) ? -1 : 1
  );
}

export function compareSeriesKeys(compare: CompetitorCompare): string[] {
  const keys: string[] = [];
  if (compare.own) keys.push("自社");
  for (const c of compare.competitors) keys.push(c.name);
  return keys;
}
