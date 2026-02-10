import { Text, Group, UnstyledButton, Avatar, Tooltip } from "@mantine/core";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { formattedDate } from "@/lib/time";
import classes from "./css/history.module.css";
import clsx from "clsx";
import { IPageHistory } from "@/features/page-history/types/page.types";
import { memo, useCallback } from "react";

const MAX_VISIBLE_AVATARS = 5;

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

  const contributors = historyItem.contributors;
  const hasContributors = contributors && contributors.length > 0;

  return (
    <UnstyledButton
      p="xs"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onHoverEnd}
      className={clsx(classes.history, { [classes.active]: isActive })}
    >
      <Text size="sm">{formattedDate(new Date(historyItem.createdAt))}</Text>

      <Group gap={6} wrap="nowrap" mt={4}>
        {hasContributors ? (
          <>
            <Tooltip.Group openDelay={300} closeDelay={100}>
              <Avatar.Group spacing={8}>
                {contributors.slice(0, MAX_VISIBLE_AVATARS).map((contributor) => (
                  <Tooltip key={contributor.id} label={contributor.name} withArrow>
                    <CustomAvatar
                      size="sm"
                      avatarUrl={contributor.avatarUrl}
                      name={contributor.name}
                    />
                  </Tooltip>
                ))}
                {contributors.length > MAX_VISIBLE_AVATARS && (
                  <Tooltip
                    withArrow
                    label={contributors.slice(MAX_VISIBLE_AVATARS).map((c) => (
                      <div key={c.id}>{c.name}</div>
                    ))}
                  >
                    <Avatar size="sm" color="gray">
                      +{contributors.length - MAX_VISIBLE_AVATARS}
                    </Avatar>
                  </Tooltip>
                )}
              </Avatar.Group>
            </Tooltip.Group>
            {contributors.length === 1 && (
              <Text size="sm" c="dimmed" lineClamp={1}>
                {contributors[0].name}
              </Text>
            )}
          </>
        ) : (
          <>
            <CustomAvatar
              size="sm"
              avatarUrl={historyItem.lastUpdatedBy?.avatarUrl}
              name={historyItem.lastUpdatedBy?.name}
            />
            <Text size="sm" c="dimmed" lineClamp={1}>
              {historyItem.lastUpdatedBy?.name}
            </Text>
          </>
        )}
      </Group>
    </UnstyledButton>
  );
});

export default HistoryItem;
