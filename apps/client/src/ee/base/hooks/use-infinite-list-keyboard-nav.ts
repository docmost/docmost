import { useEffect, useState } from "react";
import { useListKeyboardNav } from "@/ee/base/hooks/use-list-keyboard-nav";

type NextPage = {
  hasNextPage: boolean;
  isFetching: boolean;
  fetchNextPage: () => unknown;
};

export function useInfiniteListKeyboardNav(
  itemCount: number,
  resetDeps: ReadonlyArray<unknown>,
  { hasNextPage, isFetching, fetchNextPage }: NextPage,
) {
  const nav = useListKeyboardNav(itemCount, resetDeps);
  const [listEnd, setListEnd] = useState<HTMLElement | null>(null);
  const canLoadMore = hasNextPage && !isFetching;

  useEffect(() => {
    if (!listEnd || !canLoadMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchNextPage();
      },
      // the end marker sits directly in the scrolling list
      { root: listEnd.parentElement, rootMargin: "0px 0px 120px 0px" },
    );
    observer.observe(listEnd);
    return () => observer.disconnect();
  }, [listEnd, canLoadMore, fetchNextPage]);

  const handleNavKey = (e: React.KeyboardEvent): boolean => {
    // the last loaded row waits for the next page instead of wrapping to the top
    if (e.key === "ArrowDown" && hasNextPage && nav.activeIndex === itemCount - 1) {
      e.preventDefault();
      if (!isFetching) fetchNextPage();
      return true;
    }
    return nav.handleNavKey(e);
  };

  return { ...nav, handleNavKey, listEndRef: setListEnd };
}
