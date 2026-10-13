import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { ActionIcon, Text } from "@mantine/core";
import { IconPlus, IconGripVertical } from "@tabler/icons-react";
import clsx from "clsx";
import { IBaseProperty, KanbanColumn } from "@/ee/base/types/base.types";
import { choiceColor } from "@/ee/base/components/cells/choice-color";
import { useKanbanColumnDnd } from "@/ee/base/hooks/use-kanban-column-dnd";
import { BaseDropEdgeIndicator } from "@/ee/base/components/grid/base-drop-edge-indicator";
import { KanbanColumnTitle } from "@/ee/base/components/kanban/kanban-column-title";
import { KanbanColumnMenu } from "@/ee/base/components/kanban/kanban-column-menu";
import classes from "@/ee/base/styles/kanban.module.css";

type KanbanColumnHeaderProps = {
  column: KanbanColumn;
  pageId: string;
  property: IBaseProperty | undefined;
  count?: string;
  canEdit: boolean;
  onHide: () => void;
  onAddCard: () => void;
};

export function KanbanColumnHeader({ column, pageId, property, count, canEdit, onHide, onAddCard }: KanbanColumnHeaderProps) {
  const { t } = useTranslation();
  const dotColor = column.color
    ? choiceColor(column.color).color as string
    : "light-dark(var(--mantine-color-gray-4), var(--mantine-color-dark-3))";

  const headerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const { closestEdge, isDragging } = useKanbanColumnDnd({
    headerRef,
    handleRef,
    columnKey: column.key,
    pageId,
  });

  return (
    <div ref={headerRef} className={clsx(classes.columnHeader, isDragging && classes.columnHeaderDragging)}>
      {canEdit && (
        <div ref={handleRef} className={classes.columnDragHandle} aria-hidden>
          <IconGripVertical size={14} />
        </div>
      )}
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          flexShrink: 0,
          background: dotColor,
        }}
      />
      <KanbanColumnTitle column={column} property={property} pageId={pageId} canEdit={canEdit} />
      {count !== undefined && <Text className={classes.count}>{count}</Text>}
      {canEdit && (
        <>
          {property && (
            <KanbanColumnMenu property={property} pageId={pageId} onHide={onHide} />
          )}
          <ActionIcon variant="subtle" size="sm" color="gray" aria-label={t("Add card")} onClick={onAddCard}>
            <IconPlus size={14} />
          </ActionIcon>
        </>
      )}
      {closestEdge && <BaseDropEdgeIndicator edge={closestEdge} />}
    </div>
  );
}
