import { Text, Group, UnstyledButton } from "@mantine/core";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { formattedDate } from "@/lib/time";
import classes from "./css/history.module.css";
import clsx from "clsx";
import { IPageHistory } from "@/features/page-history/types/page.types";
import { memo, useCallback } from "react";

interface HistoryItemProps {
  historyItem: IPageHistory;
  index: number;
  onSelect: (id: string, index: number) => void;
  onHover?: (id: string, index: number) => void;
  onHoverEnd?: () => void;
  isActive: boolean;
}

const HistoryItem = memo(function HistoryItem({
  historyItem,
  index,
  onSelect,
  onHover,
  onHoverEnd,
  isActive,
}: HistoryItemProps) {
  const handleClick = useCallback(() => {
    onSelect(historyItem.id, index);
  }, [onSelect, historyItem.id, index]);

  const handleMouseEnter = useCallback(() => {
    onHover?.(historyItem.id, index);
  }, [onHover, historyItem.id, index]);

  return (
    <UnstyledButton
      p="xs"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onHoverEnd}
      className={clsx(classes.history, { [classes.active]: isActive })}
    >
      <Group wrap="nowrap">
        <div>
          <Text size="sm">
            {formattedDate(new Date(historyItem.createdAt))}
          </Text>

          <div style={{ flex: 1 }}>
            <Group gap={4} wrap="nowrap">
              <CustomAvatar
                size="sm"
                avatarUrl={historyItem.lastUpdatedBy?.avatarUrl}
                name={historyItem.lastUpdatedBy?.name}
              />
              <Text size="sm" c="dimmed" lineClamp={1}>
                {historyItem.lastUpdatedBy?.name}
              </Text>
            </Group>
          </div>
        </div>
      </Group>
    </UnstyledButton>
  );
});

export default HistoryItem;
