import { useState, useCallback } from "react";

/** Manages a Set<number> with toggle, expandAll, and clear operations. */
export function useToggleSet() {
  const [set, setSet] = useState<Set<number>>(new Set());

  const toggle = useCallback((i: number) => {
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSet(new Set()), []);

  const addAll = useCallback((indices: number[]) => {
    setSet((prev) => {
      const next = new Set(prev);
      for (const i of indices) next.add(i);
      return next;
    });
  }, []);

  return { set, toggle, clear, addAll };
}
