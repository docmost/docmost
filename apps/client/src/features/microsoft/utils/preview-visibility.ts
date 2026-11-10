// below 1 because callbacks only fire on 1% area steps
const VERTICALLY_VISIBLE_RATIO = 0.95;
const FILLS_SCREEN_RATIO = 0.9;

// The observer only reports at these ratios, so tall embeds need fine steps.
export const PREVIEW_VISIBILITY_THRESHOLDS = Array.from(
  { length: 101 },
  (_, i) => i / 100,
);

export function isPreviewInView(
  entry: Pick<
    IntersectionObserverEntry,
    "isIntersecting" | "intersectionRect" | "boundingClientRect" | "rootBounds"
  >,
): boolean {
  if (!entry.isIntersecting) return false;

  const visibleHeight = entry.intersectionRect.height;
  const rootHeight = entry.rootBounds?.height ?? window.innerHeight;

  return (
    visibleHeight >=
      VERTICALLY_VISIBLE_RATIO * entry.boundingClientRect.height ||
    visibleHeight >= FILLS_SCREEN_RATIO * rootHeight
  );
}
