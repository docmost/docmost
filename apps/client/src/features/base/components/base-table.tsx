import { useCallback, useEffect, useMemo } from "react";
import { Loader, Text, Stack } from "@mantine/core";
import { useAtom } from "jotai";
import { IconDatabase } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { arrayMove } from "@dnd-kit/sortable";
import { generateJitteredKeyBetween } from "fractional-indexing-jittered";
import { useBaseQuery } from "@/features/base/queries/base-query";
import { useBaseSocket } from "@/features/base/hooks/use-base-socket";
import {
  useBaseRowsQuery,
  flattenRows,
} from "@/features/base/queries/base-row-query";
import { useUpdateRowMutation } from "@/features/base/queries/base-row-query";
import { useCreateRowMutation } from "@/features/base/queries/base-row-query";
import { useReorderRowMutation } from "@/features/base/queries/base-row-query";
import { useCreateViewMutation } from "@/features/base/queries/base-view-query";
import { activeViewIdAtom } from "@/features/base/atoms/base-atoms";
import { useBaseTable } from "@/features/base/hooks/use-base-table";
import { useRowSelection } from "@/features/base/hooks/use-row-selection";
import { GridContainer } from "@/features/base/components/grid/grid-container";
import { BaseToolbar } from "@/features/base/components/base-toolbar";
import classes from "@/features/base/styles/grid.module.css";

type BaseTableProps = {
  baseId: string;
};

export function BaseTable({ baseId }: BaseTableProps) {
  const { t } = useTranslation();
  // Subscribe to the base's realtime room so other clients' edits,
  // schema changes, and async-job completions reconcile into our cache.
  useBaseSocket(baseId);
  const { data: base, isLoading: baseLoading, error: baseError } = useBaseQuery(baseId);

  const [activeViewId, setActiveViewId] = useAtom(activeViewIdAtom) as unknown as [string | null, (val: string | null) => void];

  const views = base?.views ?? [];
  const activeView = useMemo(() => {
    if (!views.length) return undefined;
    return views.find((v) => v.id === activeViewId) ?? views[0];
  }, [views, activeViewId]);

  const activeFilter = activeView?.config?.filter;
  const activeSorts = activeView?.config?.sorts;
  const { data: rowsData, isLoading: rowsLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useBaseRowsQuery(baseId, activeFilter, activeSorts);

  const updateRowMutation = useUpdateRowMutation();
  const createRowMutation = useCreateRowMutation();
  const reorderRowMutation = useReorderRowMutation();
  const createViewMutation = useCreateViewMutation();

  useEffect(() => {
    if (activeView && activeViewId !== activeView.id) {
      setActiveViewId(activeView.id);
    }
  }, [activeView, activeViewId, setActiveViewId]);

  const { clear: clearSelection } = useRowSelection();
  useEffect(() => {
    clearSelection();
  }, [baseId, activeView?.id, clearSelection]);

  const rows = useMemo(() => {
    const flat = flattenRows(rowsData);
    return flat.sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0));
  }, [rowsData]);

  const { table, persistViewConfig } = useBaseTable(base, rows, activeView);

  const handleCellUpdate = useCallback(
    (rowId: string, propertyId: string, value: unknown) => {
      updateRowMutation.mutate({
        rowId,
        baseId,
        cells: { [propertyId]: value },
      });
    },
    [baseId, updateRowMutation],
  );

  const handleAddRow = useCallback(() => {
    createRowMutation.mutate({ baseId });
  }, [baseId, createRowMutation]);

  const handleViewChange = useCallback(
    (viewId: string) => {
      setActiveViewId(viewId);
    },
    [setActiveViewId],
  );

  const handleAddView = useCallback(() => {
    createViewMutation.mutate({
      baseId,
      name: t("New view"),
      type: "table",
    });
  }, [baseId, createViewMutation, t]);

  const handleColumnReorder = useCallback(
    (activeId: string, overId: string) => {
      const currentOrder = table.getState().columnOrder;
      const oldIndex = currentOrder.indexOf(activeId);
      const newIndex = currentOrder.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
      table.setColumnOrder(newOrder);
      persistViewConfig();
    },
    [table, persistViewConfig],
  );

  const handleResizeEnd = useCallback(() => {
    persistViewConfig();
  }, [persistViewConfig]);

  const handleRowReorder = useCallback(
    (rowId: string, targetRowId: string, dropPosition: "above" | "below") => {
      const remainingRows = rows.filter((r) => r.id !== rowId);
      const targetIndex = remainingRows.findIndex((r) => r.id === targetRowId);
      if (targetIndex === -1) return;

      let lowerPos: string | null = null;
      let upperPos: string | null = null;

      if (dropPosition === "above") {
        lowerPos = targetIndex > 0 ? remainingRows[targetIndex - 1]?.position : null;
        upperPos = remainingRows[targetIndex]?.position ?? null;
      } else {
        lowerPos = remainingRows[targetIndex]?.position ?? null;
        upperPos = targetIndex < remainingRows.length - 1 ? remainingRows[targetIndex + 1]?.position : null;
      }

      try {
        let newPosition: string;
        if (lowerPos && upperPos && lowerPos === upperPos) {
          newPosition = generateJitteredKeyBetween(lowerPos, null);
        } else {
          newPosition = generateJitteredKeyBetween(lowerPos, upperPos);
        }

        reorderRowMutation.mutate({
          rowId,
          baseId,
          position: newPosition,
        });
      } catch {
        // Position computation failed — skip silently
      }
    },
    [rows, baseId, reorderRowMutation],
  );

  if (baseLoading || rowsLoading) {
    return (
      <div className={classes.loadingOverlay}>
        <Loader size="md" />
      </div>
    );
  }

  if (baseError) {
    return (
      <Stack align="center" gap="sm" p="xl">
        <IconDatabase size={40} color="var(--mantine-color-gray-5)" />
        <Text c="dimmed">{t("Failed to load base")}</Text>
      </Stack>
    );
  }

  if (!base) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <BaseToolbar
        base={base}
        activeView={activeView}
        views={views}
        table={table}
        onViewChange={handleViewChange}
        onAddView={handleAddView}
        onPersistViewConfig={persistViewConfig}
      />
      <GridContainer
        table={table}
        onCellUpdate={handleCellUpdate}
        onAddRow={handleAddRow}
        baseId={baseId}
        onColumnReorder={handleColumnReorder}
        onResizeEnd={handleResizeEnd}
        onRowReorder={handleRowReorder}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onFetchNextPage={fetchNextPage}
      />
    </div>
  );
}
