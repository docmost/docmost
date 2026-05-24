import { Badge, Text } from "@mantine/core";
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
};

export function KanbanColumnHeader({
  columnKey,
  name,
  color,
  count,
  onReorderDrop,
}: KanbanColumnHeaderProps) {
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
      {closestEdge && <BaseDropEdgeIndicator edge={closestEdge} />}
    </div>
  );
}
