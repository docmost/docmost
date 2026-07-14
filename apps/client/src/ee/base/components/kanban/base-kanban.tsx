import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { extractClosestEdge, type Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { getReorderDestinationIndex } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index";
import { reorder } from "@atlaskit/pragmatic-drag-and-drop/reorder";
import { triggerPostMoveFlash } from "@atlaskit/pragmatic-drag-and-drop-flourish/trigger-post-move-flash";
import * as liveRegion from "@atlaskit/pragmatic-drag-and-drop-live-region";
import { IBase, IBaseRow, IBaseView, FilterGroup, KANBAN_CARD_DRAG_TYPE, KANBAN_COLUMN_DRAG_TYPE } from "@/ee/base/types/base.types";
import { useKanbanColumns } from "@/ee/base/hooks/use-kanban-columns";
import { useUpdateViewMutation } from "@/ee/base/queries/base-view-query";
import { useKanbanMoveCardMutation } from "@/ee/base/queries/base-row-query";
import { buildColumnFilter } from "@/ee/base/services/kanban-column-filter";
import { resolveCardDrop } from "@/ee/base/hooks/use-kanban-card-drop";
import { useKanbanBoardAutoScroll } from "@/ee/base/hooks/use-kanban-autoscroll";
import { useRowDetailModal } from "@/ee/base/hooks/use-row-detail-modal";
import { KanbanColumn } from "@/ee/base/components/kanban/kanban-column";
import { KanbanEmptyState } from "@/ee/base/components/kanban/kanban-empty-state";
import classes from "@/ee/base/styles/kanban.module.css";

type BaseKanbanProps = {
  base: IBase;
  view: IBaseView;
  pageId: string;
  embedded?: boolean;
  editable: boolean;
  viewFilter: FilterGroup | undefined;
};

export function BaseKanban({ base, view, pageId, embedded, editable, viewFilter }: BaseKanbanProps) {
  const { t } = useTranslation();
  const { groupByPropertyId, groupByProperty, columns, hasValidGroupBy } = useKanbanColumns(base, view);
  const updateView = useUpdateViewMutation();
  const moveCard = useKanbanMoveCardMutation();
  const { openRow } = useRowDetailModal(pageId);

  const openRowRef = useRef(openRow);
  useLayoutEffect(() => { openRowRef.current = openRow; });
  const handleOpenRow = useCallback((id: string) => openRowRef.current(id), []);

  const boardRef = useRef<HTMLDivElement>(null);
  useKanbanBoardAutoScroll(boardRef, pageId);

  const cardRefs = useRef<Map<string, { columnKey: string; el: HTMLDivElement }>>(new Map());

  const registerCardRef = useCallback((rowId: string, columnKey: string, el: HTMLDivElement | null) => {
    if (el) {
      cardRefs.current.set(rowId, { columnKey, el });
    } else {
      cardRefs.current.delete(rowId);
    }
  }, []);

  const columnRows = useRef<Map<string, IBaseRow[]>>(new Map());

  const registerColumnRows = useCallback((key: string, rows: IBaseRow[]) => {
    columnRows.current.set(key, rows);
  }, []);

  const hideColumn = useCallback(
    (key: string) => {
      const next = Array.from(new Set([...(view.config?.hiddenChoiceIds ?? []), key]));
      updateView.mutate({ viewId: view.id, pageId, config: { hiddenChoiceIds: next } });
    },
    [updateView, view.id, view.config?.hiddenChoiceIds, pageId],
  );

  const onCardDropRef = useRef<(args: {
    draggedRowId: string;
    sourceColumnKey: string;
    targetColumnKey: string;
    targetRowId: string | null;
    edge: Edge | null;
  }) => void>(() => {});
  useLayoutEffect(() => {
    onCardDropRef.current = ({ draggedRowId, sourceColumnKey, targetColumnKey, targetRowId, edge }) => {
      if (!groupByPropertyId) return;
      const targetColumnRows = columnRows.current.get(targetColumnKey) ?? [];
      const result = resolveCardDrop({
        draggedRowId,
        targetRowId,
        edge: edge === "left" || edge === "right" ? null : edge,
        targetColumnKey,
        sourceColumnKey,
        targetColumnRows,
      });
      if (!result) return;
      const sourceFilter = buildColumnFilter(viewFilter, groupByPropertyId, sourceColumnKey);
      const destFilter = buildColumnFilter(viewFilter, groupByPropertyId, targetColumnKey);
      moveCard.mutate({
        pageId,
        rowId: draggedRowId,
        sourceColumnFilter: sourceFilter,
        destColumnFilter: destFilter,
        columnChanged: result.columnChanged,
        groupByPropertyId,
        destChoiceValue: result.destChoiceValue,
        position: result.position,
      });
      const el = cardRefs.current.get(draggedRowId)?.el;
      if (el) triggerPostMoveFlash(el);
      const targetColumnName = columns.find((c) => c.key === targetColumnKey)?.name ?? "";
      liveRegion.announce(t("Moved card to {{column}}", { column: targetColumnName }));
    };
  });

  useEffect(() => {
    return monitorForElements({
      canMonitor: ({ source }) =>
        source.data?.type === KANBAN_CARD_DRAG_TYPE && source.data?.pageId === pageId,
      onDrop: ({ location, source }) => {
        const target = location.current.dropTargets[0];
        if (!target) return;
        const draggedRowId = source.data.rowId as string;
        const sourceColumnKey = source.data.columnKey as string;
        const targetColumnKey = target.data.columnKey as string;
        const isColumnBody = target.data.isColumnBody === true;
        const targetRowId = isColumnBody ? null : (target.data.rowId as string);
        const edge = isColumnBody ? null : extractClosestEdge(target.data);
        onCardDropRef.current({ draggedRowId, sourceColumnKey, targetColumnKey, targetRowId, edge });
      },
    });
  }, [pageId]);

  const onColumnDropRef = useRef<(args: {
    sourceColumnKey: string;
    targetColumnKey: string;
    edge: Edge | null;
  }) => void>(() => {});
  useLayoutEffect(() => {
    onColumnDropRef.current = ({ sourceColumnKey, targetColumnKey, edge }) => {
      const fullOrder: string[] = view.config?.choiceOrder?.length
        ? view.config.choiceOrder
        : columns.map((c) => c.key);

      const startIndex = fullOrder.indexOf(sourceColumnKey);
      const indexOfTarget = fullOrder.indexOf(targetColumnKey);

      if (startIndex === -1 || indexOfTarget === -1) {
        const visibleKeys = columns.map((c) => c.key);
        const visStart = visibleKeys.indexOf(sourceColumnKey);
        const visTarget = visibleKeys.indexOf(targetColumnKey);
        if (visStart === -1 || visTarget === -1) return;
        const finishIndex = getReorderDestinationIndex({
          startIndex: visStart,
          indexOfTarget: visTarget,
          closestEdgeOfTarget: edge,
          axis: "horizontal",
        });
        if (finishIndex === visStart) return;
        const reorderedVisible = reorder({ list: visibleKeys, startIndex: visStart, finishIndex });
        updateView.mutate({ viewId: view.id, pageId, config: { choiceOrder: [...reorderedVisible, ...(view.config?.hiddenChoiceIds ?? [])] } });
      } else {
        const finishIndex = getReorderDestinationIndex({
          startIndex,
          indexOfTarget,
          closestEdgeOfTarget: edge,
          axis: "horizontal",
        });
        if (finishIndex === startIndex) return;
        const newChoiceOrder = reorder({ list: fullOrder, startIndex, finishIndex });
        updateView.mutate({ viewId: view.id, pageId, config: { choiceOrder: newChoiceOrder } });
      }

      const targetColumnName = columns.find((c) => c.key === targetColumnKey)?.name ?? "";
      liveRegion.announce(t("Moved column to {{column}}", { column: targetColumnName }));
    };
  });

  useEffect(() => {
    return monitorForElements({
      canMonitor: ({ source }) =>
        source.data?.type === KANBAN_COLUMN_DRAG_TYPE && source.data?.pageId === pageId,
      onDrop: ({ location, source }) => {
        const target = location.current.dropTargets[0];
        if (!target) return;
        const sourceColumnKey = source.data.columnKey as string;
        const targetColumnKey = target.data.columnKey as string;
        const edge = extractClosestEdge(target.data);
        onColumnDropRef.current({ sourceColumnKey, targetColumnKey, edge });
      },
    });
  }, [pageId]);

  if (!hasValidGroupBy) {
    return <KanbanEmptyState base={base} view={view} pageId={pageId} editable={editable} />;
  }

  return (
    <div
      ref={boardRef}
      className={clsx(classes.board, embedded ? classes.boardEmbed : classes.boardFullPage)}
    >
      {columns.map((column) => (
        <KanbanColumn
          key={column.key}
          base={base}
          view={view}
          pageId={pageId}
          column={column}
          viewFilter={viewFilter}
          groupByPropertyId={groupByPropertyId!}
          groupByProperty={groupByProperty}
          canEdit={editable}
          onOpenRow={handleOpenRow}
          onHide={hideColumn}
          registerCardRef={registerCardRef}
          registerColumnRows={registerColumnRows}
        />
      ))}
    </div>
  );
}
