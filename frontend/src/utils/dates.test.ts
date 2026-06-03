import { describe, expect, it } from "vitest";
import {
  addMonths,
  endOfMonth,
  isoDate,
  rangeFromPreset,
  sameDay,
  startOfMonth,
} from "./dates";

describe("date utils", () => {
  it("isoDate returns YYYY-MM-DD", () => {
    expect(isoDate(new Date("2026-05-21T12:30:00Z"))).toBe("2026-05-21");
  });

  it("rangeFromPreset returns inclusive range of N days", () => {
    const r = rangeFromPreset(7, new Date("2026-05-21T00:00:00Z"));
    expect(r.end).toBe("2026-05-21");
    expect(r.start).toBe("2026-05-15");
  });

  it("startOfMonth and endOfMonth bracket the month", () => {
    const d = new Date(2026, 4, 21); // May 21
    expect(startOfMonth(d).getDate()).toBe(1);
    expect(startOfMonth(d).getMonth()).toBe(4);
    expect(endOfMonth(d).getDate()).toBe(31); // May has 31 days
  });

  it("addMonths wraps year correctly", () => {
    expect(addMonths(new Date(2026, 11, 1), 1).getFullYear()).toBe(2027);
    expect(addMonths(new Date(2026, 11, 1), 1).getMonth()).toBe(0);
  });

  it("sameDay compares y/m/d only", () => {
    const a = new Date(2026, 4, 21, 9, 0);
    const b = new Date(2026, 4, 21, 23, 59);
    const c = new Date(2026, 4, 22, 9, 0);
    expect(sameDay(a, b)).toBe(true);
    expect(sameDay(a, c)).toBe(false);
  });
});
