import { Badge, Text } from "@mantine/core";
import classes from "@/features/base/styles/kanban.module.css";

type KanbanColumnHeaderProps = {
  name: string;
  color: string | null;
  count: number;
};

export function KanbanColumnHeader({
  name,
  color,
  count,
}: KanbanColumnHeaderProps) {
  return (
    <div className={classes.columnHeader}>
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
    </div>
  );
}
