import { type RefObject, useEffect } from "react";

// Keeps the header's scrollLeft in lockstep with the body's. Also converts
// vertical wheel events on the header into horizontal scroll on the body.
// Generic so callers can pass useRef<HTMLDivElement>(null) without a cast.
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
      // Trackpad horizontal-dominant gestures deliver deltaX; let those
      // flow naturally. Convert vertical ticks into horizontal pan.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (e.deltaY === 0) return;
      // preventDefault suppresses the default vertical scroll (requires
      // non-passive listener, configured below).
      e.preventDefault();
      body.scrollLeft += e.deltaY;
    };

    const onHeaderScroll = () => {
      if (rafId !== 0) return;
      if (body.scrollLeft !== header.scrollLeft) {
        body.scrollLeft = header.scrollLeft;
      }
    };

    body.addEventListener("scroll", onBodyScroll, { passive: true });
    header.addEventListener("scroll", onHeaderScroll, { passive: true });
    header.addEventListener("wheel", onHeaderWheel, { passive: false });

    // Initial sync in case the body is already scrolled when the hook mounts.
    header.scrollLeft = body.scrollLeft;

    return () => {
      body.removeEventListener("scroll", onBodyScroll);
      header.removeEventListener("scroll", onHeaderScroll);
      header.removeEventListener("wheel", onHeaderWheel);
      if (rafId !== 0) cancelAnimationFrame(rafId);
    };
  }, [bodyRef, headerRef]);
}
