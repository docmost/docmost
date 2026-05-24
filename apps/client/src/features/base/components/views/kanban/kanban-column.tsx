import { KanbanColumnData } from "@/features/base/hooks/use-kanban-groups";
import { IBaseProperty } from "@/features/base/types/base.types";
import { KanbanCard } from "./kanban-card";
import { KanbanColumnHeader } from "./kanban-column-header";
import { KanbanAddCardButton } from "./kanban-add-card-button";
import type { CardDropPayload } from "@/features/base/hooks/use-kanban-card-drag";
import { useKanbanColumnDrop } from "@/features/base/hooks/use-kanban-column-drop";
import classes from "@/features/base/styles/kanban.module.css";

type KanbanColumnProps = {
  column: KanbanColumnData;
  primaryProperty: IBaseProperty | undefined;
  onCardClick: (rowId: string) => void;
  onAddCard: (columnKey: string) => void;
  onCardDrop: (payload: CardDropPayload) => void;
};

export function KanbanColumn({
  column,
  primaryProperty,
  onCardClick,
  onAddCard,
  onCardDrop,
}: KanbanColumnProps) {
  const { ref: bodyRef, isOver } = useKanbanColumnDrop({
    columnKey: column.key,
    onDrop: onCardDrop,
  });

  return (
    <div className={classes.column} data-column-key={column.key}>
      <KanbanColumnHeader
        name={column.name}
        color={column.color}
        count={column.rows.length}
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
          />
        ))}
        <KanbanAddCardButton onClick={() => onAddCard(column.key)} />
      </div>
    </div>
  );
}
