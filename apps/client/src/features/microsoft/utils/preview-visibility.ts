const FULLY_ON_SCREEN_RATIO = 0.98;
const FILLS_SCREEN_RATIO = 0.9;

// The observer only reports at these ratios, so tall embeds need fine steps.
export const PREVIEW_VISIBILITY_THRESHOLDS = Array.from(
  { length: 101 },
  (_, i) => i / 100,
);

export function isPreviewInView(
  entry: Pick<
    IntersectionObserverEntry,
    "isIntersecting" | "intersectionRatio" | "intersectionRect" | "rootBounds"
  >,
): boolean {
  if (!entry.isIntersecting) return false;
  if (entry.intersectionRatio >= FULLY_ON_SCREEN_RATIO) return true;
  if (!entry.rootBounds) return false;

  return (
    entry.intersectionRect.height >=
    FILLS_SCREEN_RATIO * entry.rootBounds.height
  );
}
