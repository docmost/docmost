import { useRef, useState, ReactNode } from "react";
import { Text, TextProps, Tooltip } from "@mantine/core";

type AutoTooltipTextProps = TextProps & {
  children: ReactNode;
  tooltipLabel?: string;
  tooltipProps?: Omit<
    React.ComponentProps<typeof Tooltip>,
    "children" | "label"
  >;
};

export function AutoTooltipText({
  children,
  tooltipLabel,
  tooltipProps,
  ...textProps
}: AutoTooltipTextProps) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const handleMouseEnter = () => {
    const element = textRef.current;
    if (element) {
      setIsTruncated(element.scrollWidth > element.clientWidth);
    }
  };

  const label = tooltipLabel ?? (typeof children === "string" ? children : "");

  return (
    <Tooltip
      label={label}
      disabled={!isTruncated || !label}
      multiline
      withArrow
      {...tooltipProps}
    >
      <Text
        ref={textRef}
        truncate
        onMouseEnter={handleMouseEnter}
        {...textProps}
      >
        {children}
      </Text>
    </Tooltip>
  );
}
