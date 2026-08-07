import { CSSProperties, useRef, useState } from "react";
import { Tooltip } from "@mantine/core";
import cellClasses from "@/ee/base/styles/cells.module.css";

type ChoiceBadgeProps = {
  name: string;
  style: CSSProperties;
};

export function ChoiceBadge({ name, style }: ChoiceBadgeProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  return (
    <Tooltip label={name} withinPortal openDelay={400} disabled={!truncated}>
      <span
        ref={ref}
        className={cellClasses.badge}
        style={style}
        onMouseEnter={() => {
          const el = ref.current;
          if (el) setTruncated(el.scrollWidth > el.clientWidth);
        }}
      >
        {name}
      </span>
    </Tooltip>
  );
}
