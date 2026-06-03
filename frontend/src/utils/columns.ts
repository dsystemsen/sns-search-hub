import { useCallback, useEffect, useState } from "react";

/** Persist per-table column visibility in localStorage. */
export function useColumnVisibility(tableKey: string, allColumns: string[]) {
  const storageKey = `ui.columns.${tableKey}`;
  const [hidden, setHidden] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return new Set();
      const arr = JSON.parse(raw) as string[];
      return new Set(arr.filter((c) => allColumns.includes(c)));
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(Array.from(hidden)));
  }, [hidden, storageKey]);

  const toggle = useCallback((col: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  }, []);

  const isVisible = useCallback((col: string) => !hidden.has(col), [hidden]);
  const reset = useCallback(() => setHidden(new Set()), []);

  return { hidden, isVisible, toggle, reset };
}
