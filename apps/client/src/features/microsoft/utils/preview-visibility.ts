const FULLY_ON_SCREEN_RATIO = 0.98;
const FILLS_SCREEN_RATIO = 0.9;

export const PREVIEW_VISIBILITY_THRESHOLDS = [0, 0.25, 0.5, 0.75, 0.9, 0.98, 1];

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
