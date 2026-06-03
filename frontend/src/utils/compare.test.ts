import { describe, expect, it } from "vitest";
import { compareSeriesKeys, mergeCompareSeries } from "./compare";

describe("mergeCompareSeries", () => {
  it("merges own + competitors into one row per date", () => {
    const merged = mergeCompareSeries({
      period: { start: "2026-05-01", end: "2026-05-03" },
      own: {
        points: [
          { date: "2026-05-01", subscribers: 100 },
          { date: "2026-05-02", subscribers: 120 },
        ],
      },
      competitors: [
        {
          competitor_id: 1,
          name: "Rival",
          points: [
            { date: "2026-05-01", subscribers: 800 },
            { date: "2026-05-03", subscribers: 850 },
          ],
        },
      ],
    });
    expect(merged).toHaveLength(3);
    expect(merged[0]).toMatchObject({ date: "2026-05-01", 自社: 100, Rival: 800 });
    expect(merged[1]).toMatchObject({ date: "2026-05-02", 自社: 120 });
    expect(merged[2]).toMatchObject({ date: "2026-05-03", Rival: 850 });
  });

  it("returns chronologically sorted rows", () => {
    const merged = mergeCompareSeries({
      period: { start: "2026-05-01", end: "2026-05-03" },
      own: null,
      competitors: [
        {
          competitor_id: 1,
          name: "X",
          points: [
            { date: "2026-05-03", subscribers: 3 },
            { date: "2026-05-01", subscribers: 1 },
            { date: "2026-05-02", subscribers: 2 },
          ],
        },
      ],
    });
    expect(merged.map((r) => r.date)).toEqual([
      "2026-05-01",
      "2026-05-02",
      "2026-05-03",
    ]);
  });

  it("handles empty inputs", () => {
    expect(
      mergeCompareSeries({
        period: { start: "x", end: "y" },
        own: null,
        competitors: [],
      })
    ).toEqual([]);
  });
});

describe("compareSeriesKeys", () => {
  it("lists own first, then competitor names", () => {
    expect(
      compareSeriesKeys({
        period: { start: "x", end: "y" },
        own: { points: [] },
        competitors: [
          { competitor_id: 1, name: "A", points: [] },
          { competitor_id: 2, name: "B", points: [] },
        ],
      })
    ).toEqual(["自社", "A", "B"]);
  });

  it("omits 自社 when own is null", () => {
    expect(
      compareSeriesKeys({
        period: { start: "x", end: "y" },
        own: null,
        competitors: [{ competitor_id: 1, name: "Only", points: [] }],
      })
    ).toEqual(["Only"]);
  });
});
