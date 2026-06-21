import { forwardRef, useCallback, useRef } from "react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { IBase, IBaseRow, IBaseView } from "@/ee/base/types/base.types";
import { CardField } from "@/ee/base/components/kanban/card-field/card-field";
import { useKanbanCardDnd } from "@/ee/base/hooks/use-kanban-card-dnd";
import { BaseDropEdgeIndicator } from "@/ee/base/components/grid/base-drop-edge-indicator";
import classes from "@/ee/base/styles/kanban.module.css";

type KanbanCardProps = {
  base: IBase;
  view: IBaseView;
  row: IBaseRow;
  columnKey: string;
  onOpen: (rowId: string) => void;
};

export const KanbanCard = forwardRef<HTMLDivElement, KanbanCardProps>(
  function KanbanCard({ base, view, row, columnKey, onOpen }, ref) {
    const { t } = useTranslation();
    const primary = base.properties.find((p) => p.isPrimary);
    const title = primary ? (row.cells[primary.id] as string | undefined) : undefined;

    const visibleIds = view.config?.visiblePropertyIds ?? [];
    const propertyOrder = view.config?.propertyOrder;

    const cardProps = base.properties.filter(
      (p) => visibleIds.includes(p.id) && !p.isPrimary,
    );

    if (propertyOrder) {
      cardProps.sort(
        (a, b) => propertyOrder.indexOf(a.id) - propertyOrder.indexOf(b.id),
      );
    }

    const cardRef = useRef<HTMLDivElement>(null);

    const setCardEl = useCallback(
      (node: HTMLDivElement | null) => {
        cardRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    const { closestEdge, isDragging } = useKanbanCardDnd({
      cardRef,
      rowId: row.id,
      columnKey,
      pageId: base.id,
    });

    return (
      <div
        ref={setCardEl}
        className={clsx(classes.card, isDragging && classes.cardDragging)}
        role="button"
        tabIndex={0}
        onClick={() => onOpen(row.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(row.id);
          }
        }}
      >
        {closestEdge === "top" && <BaseDropEdgeIndicator edge="top" />}
        <div className={clsx(classes.cardTitle, !title && classes.cardUntitled)}>
          {title || t("Untitled")}
        </div>
        {cardProps.map((property) => (
          <CardField
            key={property.id}
            property={property}
            value={row.cells[property.id]}
            pageId={base.id}
          />
        ))}
        {closestEdge === "bottom" && <BaseDropEdgeIndicator edge="bottom" />}
      </div>
    );
  },
);
