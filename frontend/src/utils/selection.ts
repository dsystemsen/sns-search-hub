import { useCallback, useMemo, useState } from "react";

export type SelectionState<T extends string | number> = {
  selected: Set<T>;
  toggle: (id: T, allIds: T[], shiftKey?: boolean) => void;
  toggleAll: (allIds: T[]) => void;
  clear: () => void;
  isSelected: (id: T) => boolean;
  count: number;
  allSelected: (allIds: T[]) => boolean;
};

/**
 * Multi-select hook with shift-click range support.
 *
 * When the user shift-clicks a row, every row between the previous click and
 * the current one (in the current ordering) is set to the same selected state
 * as the clicked row.
 */
export function useSelection<T extends string | number>(): SelectionState<T> {
  const [selected, setSelected] = useState<Set<T>>(new Set());
  const [lastId, setLastId] = useState<T | null>(null);

  const toggle = useCallback(
    (id: T, allIds: T[], shiftKey = false) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (shiftKey && lastId !== null) {
          const a = allIds.indexOf(lastId);
          const b = allIds.indexOf(id);
          if (a !== -1 && b !== -1) {
            const [lo, hi] = a < b ? [a, b] : [b, a];
            const targetState = !prev.has(id);
            for (let i = lo; i <= hi; i++) {
              if (targetState) next.add(allIds[i]);
              else next.delete(allIds[i]);
            }
            return next;
          }
        }
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setLastId(id);
    },
    [lastId]
  );

  const toggleAll = useCallback((allIds: T[]) => {
    setSelected((prev) => {
      if (allIds.every((id) => prev.has(id))) return new Set();
      return new Set(allIds);
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const isSelected = useCallback((id: T) => selected.has(id), [selected]);

  const allSelected = useCallback(
    (allIds: T[]) => allIds.length > 0 && allIds.every((id) => selected.has(id)),
    [selected]
  );

  const count = useMemo(() => selected.size, [selected]);

  return { selected, toggle, toggleAll, clear, isSelected, count, allSelected };
}
