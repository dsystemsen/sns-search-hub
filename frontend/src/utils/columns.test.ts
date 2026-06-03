import { beforeEach, describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useColumnVisibility } from "./columns";

beforeEach(() => {
  localStorage.clear();
});

describe("useColumnVisibility", () => {
  it("starts with all columns visible", () => {
    const { result } = renderHook(() => useColumnVisibility("test", ["a", "b", "c"]));
    expect(result.current.isVisible("a")).toBe(true);
    expect(result.current.isVisible("b")).toBe(true);
  });

  it("toggle hides a column", () => {
    const { result } = renderHook(() => useColumnVisibility("test", ["a", "b"]));
    act(() => result.current.toggle("a"));
    expect(result.current.isVisible("a")).toBe(false);
    expect(result.current.isVisible("b")).toBe(true);
  });

  it("persists hidden columns to localStorage", () => {
    const { result } = renderHook(() => useColumnVisibility("test", ["a", "b"]));
    act(() => result.current.toggle("a"));
    expect(localStorage.getItem("ui.columns.test")).toContain("a");
  });

  it("restores hidden columns on remount", () => {
    localStorage.setItem("ui.columns.test", JSON.stringify(["b"]));
    const { result } = renderHook(() => useColumnVisibility("test", ["a", "b"]));
    expect(result.current.isVisible("a")).toBe(true);
    expect(result.current.isVisible("b")).toBe(false);
  });

  it("ignores stored columns no longer in the schema", () => {
    localStorage.setItem("ui.columns.test", JSON.stringify(["removed_col"]));
    const { result } = renderHook(() => useColumnVisibility("test", ["a", "b"]));
    expect(result.current.hidden.size).toBe(0);
  });

  it("reset clears hidden", () => {
    const { result } = renderHook(() => useColumnVisibility("test", ["a", "b"]));
    act(() => result.current.toggle("a"));
    act(() => result.current.reset());
    expect(result.current.isVisible("a")).toBe(true);
  });
});
