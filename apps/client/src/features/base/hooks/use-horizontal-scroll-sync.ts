import { type RefObject, useEffect } from "react";

/**
 * Keep a header element's horizontal scroll position in lockstep with a
 * body element's. The body has the visible scrollbar (`overflow-x: auto`);
 * the header is `overflow-x: hidden` and scrolled programmatically.
 *
 * Also forwards vertical wheel events on the header into horizontal
 * scroll on the body, so users can pan the header with their wheel —
 * the body's scroll then mirrors back here through the same path.
 *
 * Generic over the concrete element type so callers can pass
 * `useRef<HTMLDivElement>(null)` without an as-cast.
 */
export function useHorizontalScrollSync<
  TBody extends HTMLElement,
  THeader extends HTMLElement,
>(
  bodyRef: RefObject<TBody | null>,
  headerRef: RefObject<THeader | null>,
): void {
  useEffect(() => {
    const body = bodyRef.current;
    const header = headerRef.current;
    if (!body || !header) return;

    let rafId = 0;

    const sync = () => {
      rafId = 0;
      header.scrollLeft = body.scrollLeft;
    };

    const onBodyScroll = () => {
      if (rafId !== 0) return;
      rafId = requestAnimationFrame(sync);
    };

    const onHeaderWheel = (e: WheelEvent) => {
      // Horizontal-dominant gestures (trackpad pan) already deliver
      // deltaX; let those flow naturally to the body via mirrored
      // scrollLeft. Convert vertical wheel ticks into horizontal pan.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (e.deltaY === 0) return;
      body.scrollLeft += e.deltaY;
    };

    body.addEventListener("scroll", onBodyScroll, { passive: true });
    header.addEventListener("wheel", onHeaderWheel, { passive: true });

    // Initial sync — covers the case where body is already scrolled
    // when the hook mounts (e.g. after a route change).
    header.scrollLeft = body.scrollLeft;

    return () => {
      body.removeEventListener("scroll", onBodyScroll);
      header.removeEventListener("wheel", onHeaderWheel);
      if (rafId !== 0) cancelAnimationFrame(rafId);
    };
  }, [bodyRef, headerRef]);
}
