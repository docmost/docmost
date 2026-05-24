import { IBaseProperty, IBaseRow } from "@/features/base/types/base.types";
import classes from "@/features/base/styles/kanban.module.css";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import {
  useKanbanCardDrag,
  type CardDropPayload,
} from "@/features/base/hooks/use-kanban-card-drag";
import { BaseDropEdgeIndicator } from "@/features/base/components/grid/base-drop-edge-indicator";

type KanbanCardProps = {
  row: IBaseRow;
  columnKey: string;
  primaryProperty: IBaseProperty | undefined;
  onClick: (rowId: string) => void;
  onDrop: (payload: CardDropPayload) => void;
  sortsActive: boolean;
};

export function KanbanCard({
  row,
  columnKey,
  primaryProperty,
  onClick,
  onDrop,
  sortsActive,
}: KanbanCardProps) {
  const { t } = useTranslation();
  const { ref, isDragging, closestEdge } = useKanbanCardDrag({
    cardId: row.id,
    columnKey,
    onDrop,
    sortsActive,
  });

  const titleValue = primaryProperty
    ? ((row.cells ?? {})[primaryProperty.id] as string | undefined)
    : undefined;
  const titleText = titleValue?.trim().length ? titleValue : t("Untitled");
  const isEmpty = !titleValue?.trim().length;

  return (
    <div
      ref={ref}
      className={classes.card}
      data-row-id={row.id}
      data-dragging={isDragging || undefined}
      role="button"
      tabIndex={0}
      onClick={() => onClick(row.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(row.id);
        }
      }}
    >
      <div className={clsx(classes.cardTitle, isEmpty && classes.cardTitleEmpty)}>
        {titleText}
      </div>
      {closestEdge && <BaseDropEdgeIndicator edge={closestEdge} />}
    </div>
  );
}
