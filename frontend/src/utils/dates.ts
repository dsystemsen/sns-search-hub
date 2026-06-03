export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function rangeFromPreset(days: number, today: Date = new Date()) {
  const end = new Date(today);
  const start = new Date(today);
  start.setDate(end.getDate() - (days - 1));
  return { start: isoDate(start), end: isoDate(end) };
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
