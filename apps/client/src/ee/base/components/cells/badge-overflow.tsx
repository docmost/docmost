import { ReactElement, useLayoutEffect, useRef, useState } from "react";
import { Tooltip } from "@mantine/core";
import cellClasses from "@/ee/base/styles/cells.module.css";

export function computeVisibleBadgeCount(
  itemWidths: number[],
  gap: number,
  available: number,
  badgeWidth: number,
): number {
  const count = itemWidths.length;
  if (count === 0) return 0;
  if (available <= 0) return count;

  let lineWidth = 0;
  for (let i = 0; i < count; i++) {
    lineWidth += itemWidths[i] + (i > 0 ? gap : 0);
  }
  if (lineWidth <= available) return count;

  let used = 0;
  let fit = 0;
  for (let i = 0; i < count; i++) {
    const advance = itemWidths[i] + (i > 0 ? gap : 0);
    if (used + advance + gap + badgeWidth <= available) {
      used += advance;
      fit = i + 1;
    } else {
      break;
    }
  }
  return Math.max(fit, 1);
}

const BADGE_GAP = 4;

type BadgeOverflowListProps = {
  chips: ReactElement[];
  measureKey: string;
  tooltipLabel?: string;
};

export function BadgeOverflowList({
  chips,
  measureKey,
  tooltipLabel,
}: BadgeOverflowListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(chips.length);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const recompute = () => {
      const nodes = Array.from(measure.children) as HTMLElement[];
      const chipWidths = nodes.slice(0, -1).map((n) => n.offsetWidth);
      const badgeWidth = nodes[nodes.length - 1]?.offsetWidth ?? 0;
      setVisibleCount(
        computeVisibleBadgeCount(
          chipWidths,
          BADGE_GAP,
          container.clientWidth,
          badgeWidth,
        ),
      );
    };

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(container);
    return () => observer.disconnect();
  }, [measureKey]);

  const visible = chips.slice(0, visibleCount);
  const overflow = chips.length - visibleCount;

  return (
    <Tooltip
      label={tooltipLabel}
      multiline
      withinPortal
      openDelay={400}
      disabled={!tooltipLabel || overflow <= 0}
    >
      <div className={cellClasses.badgeGroup} ref={containerRef}>
        <div className={cellClasses.badgeMeasure} ref={measureRef} aria-hidden>
          {chips}
          <span className={cellClasses.overflowCount}>+{chips.length}</span>
        </div>
        {visible}
        {overflow > 0 && (
          <span className={cellClasses.overflowCount}>+{overflow}</span>
        )}
      </div>
    </Tooltip>
  );
}
