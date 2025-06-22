import { shareFullPageWidthAtom } from "@/features/share/atoms/sidebar-atom";
import { ActionIcon, Tooltip } from "@mantine/core";
import { IconArrowsMaximize, IconArrowsMinimize } from "@tabler/icons-react";
import { useAtom } from "jotai";

export function FullWidthToggle() {
  const [isFullWidth, setIsFullWidth] = useAtom(shareFullPageWidthAtom);

  return (
    <Tooltip label="Toggle page width">
      <ActionIcon
        variant="default"
        onClick={() => setIsFullWidth(!isFullWidth)}
        style={{ border: "none" }}
        size="sm"
        aria-label="Toggle page width"
      >
        {isFullWidth ? (
          <IconArrowsMinimize size={18} />
        ) : (
          <IconArrowsMaximize size={18} />
        )}
      </ActionIcon>
    </Tooltip>
  );
}
