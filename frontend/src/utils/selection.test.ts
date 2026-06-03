import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSelection } from "./selection";

describe("useSelection", () => {
  it("toggles individual items", () => {
    const { result } = renderHook(() => useSelection<number>());
    act(() => result.current.toggle(1, [1, 2, 3]));
    expect(result.current.isSelected(1)).toBe(true);
    expect(result.current.count).toBe(1);
    act(() => result.current.toggle(1, [1, 2, 3]));
    expect(result.current.isSelected(1)).toBe(false);
    expect(result.current.count).toBe(0);
  });

  it("shift-click selects range between previous and current", () => {
    const ids = [10, 20, 30, 40, 50];
    const { result } = renderHook(() => useSelection<number>());
    act(() => result.current.toggle(10, ids));
    act(() => result.current.toggle(40, ids, true));
    [10, 20, 30, 40].forEach((id) => expect(result.current.isSelected(id)).toBe(true));
    expect(result.current.isSelected(50)).toBe(false);
    expect(result.current.count).toBe(4);
  });

  it("shift-click range works backwards", () => {
    const ids = [10, 20, 30, 40];
    const { result } = renderHook(() => useSelection<number>());
    act(() => result.current.toggle(40, ids));
    act(() => result.current.toggle(20, ids, true));
    [20, 30, 40].forEach((id) => expect(result.current.isSelected(id)).toBe(true));
    expect(result.current.isSelected(10)).toBe(false);
  });

  it("toggleAll selects/clears every id", () => {
    const ids = [1, 2, 3];
    const { result } = renderHook(() => useSelection<number>());
    act(() => result.current.toggleAll(ids));
    expect(result.current.count).toBe(3);
    expect(result.current.allSelected(ids)).toBe(true);
    act(() => result.current.toggleAll(ids));
    expect(result.current.count).toBe(0);
  });

  it("clear removes everything", () => {
    const { result } = renderHook(() => useSelection<number>());
    act(() => result.current.toggle(1, [1, 2, 3]));
    act(() => result.current.toggle(2, [1, 2, 3]));
    act(() => result.current.clear());
    expect(result.current.count).toBe(0);
  });
});
