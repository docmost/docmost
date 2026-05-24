import { useMemo } from "react";
import {
  IBase,
  IBaseRow,
  IBaseView,
} from "@/features/base/types/base.types";
import { useKanbanGroups } from "@/features/base/hooks/use-kanban-groups";
import { KanbanColumn } from "./kanban-column";
import classes from "@/features/base/styles/kanban.module.css";

type BaseKanbanProps = {
  base: IBase;
  rows: IBaseRow[];
  effectiveView: IBaseView | undefined;
  onCardClick: (rowId: string) => void;
};

export function BaseKanban({
  base,
  rows,
  effectiveView,
  onCardClick,
}: BaseKanbanProps) {
  const groupByPropertyId = effectiveView?.config?.groupByPropertyId;
  const property = useMemo(
    () =>
      groupByPropertyId
        ? base.properties.find((p) => p.id === groupByPropertyId)
        : undefined,
    [groupByPropertyId, base.properties],
  );
  const primaryProperty = useMemo(
    () => base.properties.find((p) => p.isPrimary),
    [base.properties],
  );
  const isGroupable = property?.type === "select" || property?.type === "status";
  const { columns } = useKanbanGroups(
    rows,
    isGroupable ? property : undefined,
    effectiveView?.config?.hiddenChoiceIds,
    effectiveView?.config?.choiceOrder,
  );

  return (
    <div className={classes.board}>
      {columns.map((column) => (
        <KanbanColumn
          key={column.key}
          column={column}
          primaryProperty={primaryProperty}
          onCardClick={onCardClick}
        />
      ))}
    </div>
  );
}
