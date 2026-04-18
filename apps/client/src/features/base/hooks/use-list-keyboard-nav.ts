import { useCallback, useEffect, useRef, useState } from "react";

type UseListKeyboardNavResult = {
  activeIndex: number;
  setActiveIndex: (idx: number) => void;
  handleNavKey: (e: React.KeyboardEvent) => boolean;
  setOptionRef: (idx: number) => (el: HTMLElement | null) => void;
};

export function useListKeyboardNav(
  itemCount: number,
  resetDeps: ReadonlyArray<unknown>,
): UseListKeyboardNavResult {
  const [activeIndex, setActiveIndex] = useState(-1);
  const optionRefs = useRef<Array<HTMLElement | null>>([]);

  // Reset highlight when filter/open-state changes. resetDeps is intentional.
  useEffect(() => {
    setActiveIndex(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetDeps);

  useEffect(() => {
    if (activeIndex < 0) return;
    const el = optionRefs.current[activeIndex];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const setOptionRef = useCallback(
    (idx: number) => (el: HTMLElement | null) => {
      optionRefs.current[idx] = el;
    },
    [],
  );

  const handleNavKey = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (itemCount === 0) return false;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((idx) => (idx < itemCount - 1 ? idx + 1 : 0));
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((idx) => (idx <= 0 ? itemCount - 1 : idx - 1));
        return true;
      }
      if (e.key === "Home") {
        e.preventDefault();
        setActiveIndex(0);
        return true;
      }
      if (e.key === "End") {
        e.preventDefault();
        setActiveIndex(itemCount - 1);
        return true;
      }
      return false;
    },
    [itemCount],
  );

  return { activeIndex, setActiveIndex, handleNavKey, setOptionRef };
}
