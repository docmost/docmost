import { useCallback } from "react";
import { KanbanColumnData } from "@/features/base/hooks/use-kanban-groups";
import { IBaseProperty } from "@/features/base/types/base.types";
import { KanbanCard } from "./kanban-card";
import { KanbanColumnHeader } from "./kanban-column-header";
import { KanbanAddCardButton } from "./kanban-add-card-button";
import type { CardDropPayload } from "@/features/base/hooks/use-kanban-card-drag";
import type { ColumnReorderPayload } from "@/features/base/hooks/use-kanban-column-reorder";
import { useKanbanColumnDrop } from "@/features/base/hooks/use-kanban-column-drop";
import { useKanbanAutoScroll } from "@/features/base/hooks/use-kanban-auto-scroll";
import classes from "@/features/base/styles/kanban.module.css";

type KanbanColumnProps = {
  column: KanbanColumnData;
  primaryProperty: IBaseProperty | undefined;
  onCardClick: (rowId: string) => void;
  onAddCard: (columnKey: string) => void;
  onCardDrop: (payload: CardDropPayload) => void;
  onColumnReorder: (payload: ColumnReorderPayload) => void;
  onHide: (columnKey: string) => void;
  sortsActive: boolean;
};

export function KanbanColumn({
  column,
  primaryProperty,
  onCardClick,
  onAddCard,
  onCardDrop,
  onColumnReorder,
  onHide,
  sortsActive,
}: KanbanColumnProps) {
  const { ref: bodyRef, isOver } = useKanbanColumnDrop({
    columnKey: column.key,
    onDrop: onCardDrop,
  });
  const canScrollColumn = useCallback(
    ({ source }: { source: { data: Record<string, unknown> } }) =>
      source.data.type === "base-kanban-card",
    [],
  );
  useKanbanAutoScroll(bodyRef, canScrollColumn);

  return (
    <div className={classes.column} data-column-key={column.key}>
      <KanbanColumnHeader
        columnKey={column.key}
        name={column.name}
        color={column.color}
        count={column.rows.length}
        onReorderDrop={onColumnReorder}
        onHide={onHide}
      />
      <div
        ref={bodyRef}
        className={classes.columnBody}
        data-column-body={column.key}
        data-over={isOver || undefined}
      >
        {column.rows.map((row) => (
          <KanbanCard
            key={row.id}
            row={row}
            columnKey={column.key}
            primaryProperty={primaryProperty}
            onClick={onCardClick}
            onDrop={onCardDrop}
            sortsActive={sortsActive}
          />
        ))}
        <KanbanAddCardButton onClick={() => onAddCard(column.key)} />
      </div>
    </div>
  );
}
