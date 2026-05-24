import { ActionIcon, Badge, Menu, Text } from "@mantine/core";
import { IconDots, IconEyeOff } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  useKanbanColumnReorder,
  type ColumnReorderPayload,
} from "@/features/base/hooks/use-kanban-column-reorder";
import { BaseDropEdgeIndicator } from "@/features/base/components/grid/base-drop-edge-indicator";
import classes from "@/features/base/styles/kanban.module.css";

type KanbanColumnHeaderProps = {
  columnKey: string;
  name: string;
  color: string | null;
  count: number;
  onReorderDrop: (payload: ColumnReorderPayload) => void;
  onHide: (columnKey: string) => void;
};

export function KanbanColumnHeader({
  columnKey,
  name,
  color,
  count,
  onReorderDrop,
  onHide,
}: KanbanColumnHeaderProps) {
  const { t } = useTranslation();
  const { ref, isDragging, closestEdge } = useKanbanColumnReorder({
    columnKey,
    onDrop: onReorderDrop,
  });
  return (
    <div
      ref={ref}
      className={classes.columnHeader}
      data-dragging={isDragging || undefined}
    >
      <div className={classes.columnHeaderLeft}>
        {color ? (
          <Badge color={color} variant="light" size="sm">
            {name}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            {name}
          </Text>
        )}
        <span className={classes.columnCount}>{count}</span>
      </div>
      <Menu shadow="md" width={160} position="bottom-end">
        <Menu.Target>
          <ActionIcon variant="subtle" size="sm" color="gray" data-no-drag>
            <IconDots size={14} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            leftSection={<IconEyeOff size={14} />}
            onClick={() => onHide(columnKey)}
          >
            {t("Hide group")}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      {closestEdge && <BaseDropEdgeIndicator edge={closestEdge} />}
    </div>
  );
}
