import {
  Text,
  Group,
  UnstyledButton,
  Avatar,
  Tooltip,
  ActionIcon,
  Checkbox,
  Menu,
} from "@mantine/core";
import { IconDots } from "@tabler/icons-react";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { formattedDate } from "@/lib/time";
import classes from "./css/history.module.css";
import clsx from "clsx";
import { IPageHistory } from "@/features/page-history/types/page.types";
import { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";

const MAX_VISIBLE_AVATARS = 5;

interface HistoryItemProps {
  historyItem: IPageHistory;
  index: number;
  onSelect: (id: string, index: number) => void;
  onHover?: (id: string, index: number) => void;
  onHoverEnd?: () => void;
  isActive: boolean;
  compareMode: boolean;
  isChecked: boolean;
  isCheckboxDisabled: boolean;
  canCompare: boolean;
  onToggleCompare: (id: string) => void;
  onStartCompare: (id: string) => void;
  onRestore?: (id: string, index: number) => void;
}

const HistoryItem = memo(function HistoryItem({
  historyItem,
  index,
  onSelect,
  onHover,
  onHoverEnd,
  isActive,
  compareMode,
  isChecked,
  isCheckboxDisabled,
  canCompare,
  onToggleCompare,
  onStartCompare,
  onRestore,
}: HistoryItemProps) {
  const { t } = useTranslation();
  const date = formattedDate(new Date(historyItem.createdAt));

  const handleClick = useCallback(() => {
    if (compareMode) {
      onToggleCompare(historyItem.id);
    } else {
      onSelect(historyItem.id, index);
    }
  }, [compareMode, onToggleCompare, onSelect, historyItem.id, index]);

  const handleMouseEnter = useCallback(() => {
    onHover?.(historyItem.id, index);
  }, [onHover, historyItem.id, index]);

  const contributors = historyItem.contributors;
  const hasContributors = contributors && contributors.length > 0;

  return (
    <div
      className={clsx(classes.history, { [classes.active]: isActive })}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onHoverEnd}
    >
      {compareMode && (
        <Checkbox
          size="xs"
          className={classes.compareCheckbox}
          checked={isChecked}
          disabled={isCheckboxDisabled}
          onChange={() => onToggleCompare(historyItem.id)}
          aria-label={t("Select version from {{date}}", { date })}
        />
      )}

      <UnstyledButton
        p="xs"
        onClick={handleClick}
        className={classes.historyButton}
      >
        <Text size="sm">{date}</Text>

        <Group gap={6} wrap="nowrap" mt={4}>
          {hasContributors ? (
            <>
              <Tooltip.Group openDelay={300} closeDelay={100}>
                <Avatar.Group spacing={8}>
                  {contributors
                    .slice(0, MAX_VISIBLE_AVATARS)
                    .map((contributor) => (
                      <Tooltip
                        key={contributor.id}
                        label={contributor.name}
                        withArrow
                      >
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
                      label={contributors
                        .slice(MAX_VISIBLE_AVATARS)
                        .map((c) => (
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

      {!compareMode && (
        <Menu shadow="md" width={180} position="bottom-end">
          <Menu.Target>
            <ActionIcon
              variant="subtle"
              color="gray"
              className={classes.itemMenu}
              aria-label={t("Version actions for {{date}}", { date })}
              onClick={(e) => e.stopPropagation()}
            >
              <IconDots size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              disabled={!canCompare}
              onClick={() => onStartCompare(historyItem.id)}
            >
              {t("Compare")}
            </Menu.Item>
            {onRestore && (
              <Menu.Item onClick={() => onRestore(historyItem.id, index)}>
                {t("Restore")}
              </Menu.Item>
            )}
          </Menu.Dropdown>
        </Menu>
      )}
    </div>
  );
});

export default HistoryItem;
