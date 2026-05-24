import { useCallback, useMemo } from "react";
import { Badge } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import {
  IBase,
  IBaseRow,
  IBaseView,
  NO_VALUE_CHOICE_ID,
} from "@/features/base/types/base.types";
import { useKanbanGroups } from "@/features/base/hooks/use-kanban-groups";
import { useUpdateViewMutation } from "@/features/base/queries/base-view-query";
import {
  useCreateRowMutation,
  useReorderRowMutation,
  useUpdateRowMutation,
} from "@/features/base/queries/base-row-query";
import { resolveCardDrop } from "@/features/base/hooks/resolve-card-drop";
import type { CardDropPayload } from "@/features/base/hooks/use-kanban-card-drag";
import type { ColumnReorderPayload } from "@/features/base/hooks/use-kanban-column-reorder";
import { triggerPostMoveFlash } from "@atlaskit/pragmatic-drag-and-drop-flourish/trigger-post-move-flash";
import * as liveRegion from "@atlaskit/pragmatic-drag-and-drop-live-region";
import { KanbanColumn } from "./kanban-column";
import { KanbanEmptyState } from "./kanban-empty-state";
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
  const updateViewMutation = useUpdateViewMutation();
  const createRowMutation = useCreateRowMutation();
  const updateRowMutation = useUpdateRowMutation();
  const reorderRowMutation = useReorderRowMutation();
  const sortsActive = (effectiveView?.config?.sorts?.length ?? 0) > 0;

  // Rules of Hooks: call useKanbanGroups unconditionally with `undefined`
  // when not groupable; switch the render path on isGroupable below.
  const { columns } = useKanbanGroups(
    rows,
    isGroupable ? property : undefined,
    effectiveView?.config?.hiddenChoiceIds,
    effectiveView?.config?.choiceOrder,
  );

  const handlePickProperty = (propertyId: string) => {
    if (!effectiveView) return;
    updateViewMutation.mutate({
      viewId: effectiveView.id,
      pageId: base.id,
      config: { ...effectiveView.config, groupByPropertyId: propertyId },
    });
  };

  const handleCardDrop = useCallback(
    (payload: CardDropPayload) => {
      if (!groupByPropertyId) return;
      const targetColumn = columns.find((c) => c.key === payload.targetColumnKey);
      // The drop target restricts allowedEdges to ["top","bottom"], so the
      // runtime value is always assignable; narrow the broader Edge union.
      const edge =
        payload.edge === "top" || payload.edge === "bottom"
          ? payload.edge
          : null;
      const result = resolveCardDrop({
        draggedCardId: payload.draggedCardId,
        targetCardId: payload.targetCardId,
        edge,
        sourceColumnKey: payload.sourceColumnKey,
        targetColumnKey: payload.targetColumnKey,
        groupByPropertyId,
        columnRows: targetColumn?.rows ?? [],
        sortsActive,
      });

      if (result.cells !== undefined) {
        updateRowMutation.mutate({
          rowId: payload.draggedCardId,
          pageId: base.id,
          cells: result.cells,
          ...(result.position !== undefined && { position: result.position }),
        });
      } else if (result.position !== undefined) {
        reorderRowMutation.mutate({
          rowId: payload.draggedCardId,
          pageId: base.id,
          position: result.position,
        });
      }

      // a11y + post-move flash on the dropped card (if still in DOM).
      const el = document.querySelector(
        `[data-row-id="${payload.draggedCardId}"]`,
      );
      if (el instanceof HTMLElement) triggerPostMoveFlash(el);
      const colName = targetColumn?.name ?? "column";
      liveRegion.announce(`Moved card to ${colName}`);
    },
    [
      base.id,
      columns,
      groupByPropertyId,
      reorderRowMutation,
      sortsActive,
      updateRowMutation,
    ],
  );

  const handleAddCard = (columnKey: string) => {
    if (!groupByPropertyId) return;
    const cells =
      columnKey === NO_VALUE_CHOICE_ID
        ? {}
        : { [groupByPropertyId]: columnKey };
    const column = columns.find((c) => c.key === columnKey);
    const afterRowId = column?.rows[column.rows.length - 1]?.id;
    createRowMutation.mutate({
      pageId: base.id,
      cells,
      afterRowId,
    });
  };

  const handleColumnReorder = useCallback(
    (payload: ColumnReorderPayload) => {
      if (!effectiveView) return;
      const current = columns.map((c) => c.key);
      const fromIdx = current.indexOf(payload.draggedColumnKey);
      const toIdx = current.indexOf(payload.targetColumnKey);
      if (fromIdx === -1 || toIdx === -1) return;
      const next = current.slice();
      next.splice(fromIdx, 1);
      const insertAt =
        payload.edge === "left"
          ? toIdx > fromIdx
            ? toIdx - 1
            : toIdx
          : toIdx > fromIdx
            ? toIdx
            : toIdx + 1;
      next.splice(insertAt, 0, payload.draggedColumnKey);

      updateViewMutation.mutate({
        viewId: effectiveView.id,
        pageId: base.id,
        config: { ...effectiveView.config, choiceOrder: next },
      });
    },
    [base.id, columns, effectiveView, updateViewMutation],
  );

  const handleHideColumn = useCallback(
    (columnKey: string) => {
      if (!effectiveView) return;
      const current = effectiveView.config?.hiddenChoiceIds ?? [];
      if (current.includes(columnKey)) return;
      updateViewMutation.mutate({
        viewId: effectiveView.id,
        pageId: base.id,
        config: {
          ...effectiveView.config,
          hiddenChoiceIds: [...current, columnKey],
        },
      });
    },
    [base.id, effectiveView, updateViewMutation],
  );

  const handleShowColumn = useCallback(
    (columnKey: string) => {
      if (!effectiveView) return;
      const next = (effectiveView.config?.hiddenChoiceIds ?? []).filter(
        (id) => id !== columnKey,
      );
      updateViewMutation.mutate({
        viewId: effectiveView.id,
        pageId: base.id,
        config: { ...effectiveView.config, hiddenChoiceIds: next },
      });
    },
    [base.id, effectiveView, updateViewMutation],
  );

  const hiddenIds = effectiveView?.config?.hiddenChoiceIds ?? [];
  const hiddenChoices = useMemo(() => {
    if (!isGroupable || hiddenIds.length === 0) return [];
    const opts = (property!.typeOptions as { choices?: Array<{ id: string; name: string; color: string }> } | undefined) ?? {};
    const choices = opts.choices ?? [];
    const byId = new Map(choices.map((c) => [c.id, c]));
    return hiddenIds
      .map((id) =>
        id === NO_VALUE_CHOICE_ID
          ? { id, name: "No value", color: null as string | null }
          : byId.get(id)
            ? { id, name: byId.get(id)!.name, color: byId.get(id)!.color as string | null }
            : null,
      )
      .filter((c): c is { id: string; name: string; color: string | null } => c !== null);
  }, [hiddenIds, isGroupable, property]);

  if (!isGroupable) {
    return <KanbanEmptyState base={base} onPick={handlePickProperty} />;
  }

  return (
    <>
      {hiddenChoices.length > 0 && (
        <div style={{ padding: "6px 12px", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {hiddenChoices.map((c) => (
            <Badge
              key={c.id}
              color={c.color ?? "gray"}
              variant="outline"
              style={{ cursor: "pointer" }}
              onClick={() => handleShowColumn(c.id)}
              rightSection={<IconPlus size={12} />}
            >
              {c.name}
            </Badge>
          ))}
        </div>
      )}
      <div className={classes.board}>
        {columns.map((column) => (
          <KanbanColumn
            key={column.key}
            column={column}
            primaryProperty={primaryProperty}
            onCardClick={onCardClick}
            onAddCard={handleAddCard}
            onCardDrop={handleCardDrop}
            onColumnReorder={handleColumnReorder}
            onHide={handleHideColumn}
          />
        ))}
      </div>
    </>
  );
}
