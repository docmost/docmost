import { useCallback, useEffect, useMemo } from "react";
import { Text, Stack } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAtom } from "jotai";
import { IconDatabase } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { arrayMove } from "@dnd-kit/sortable";
import { generateJitteredKeyBetween } from "fractional-indexing-jittered";
import { useBaseQuery } from "@/features/base/queries/base-query";
import { useBaseSocket } from "@/features/base/hooks/use-base-socket";
import {
  FilterGroup,
  ViewSortConfig,
} from "@/features/base/types/base.types";
import {
  useBaseRowsQuery,
  flattenRows,
} from "@/features/base/queries/base-row-query";
import { useUpdateRowMutation } from "@/features/base/queries/base-row-query";
import { useCreateRowMutation } from "@/features/base/queries/base-row-query";
import { useReorderRowMutation } from "@/features/base/queries/base-row-query";
import {
  useCreateViewMutation,
  useUpdateViewMutation,
} from "@/features/base/queries/base-view-query";
import { activeViewIdAtom } from "@/features/base/atoms/base-atoms";
import { useBaseTable } from "@/features/base/hooks/use-base-table";
import { useRowSelection } from "@/features/base/hooks/use-row-selection";
import useCurrentUser from "@/features/user/hooks/use-current-user";
import { useViewDraft } from "@/features/base/hooks/use-view-draft";
import { useSpaceQuery } from "@/features/space/queries/space-query";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type";
import { GridContainer } from "@/features/base/components/grid/grid-container";
import { BaseToolbar } from "@/features/base/components/base-toolbar";
import { BaseViewDraftBanner } from "@/features/base/components/base-view-draft-banner";
import { BaseTableSkeleton } from "@/features/base/components/base-table-skeleton";
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

  const { data: currentUser } = useCurrentUser();
  const {
    draft: _draft,
    effectiveFilter,
    effectiveSorts,
    isDirty,
    setFilter: setDraftFilter,
    setSorts: setDraftSorts,
    reset: resetDraft,
    buildPromotedConfig,
  } = useViewDraft({
    userId: currentUser?.user.id,
    baseId,
    viewId: activeView?.id,
    baselineFilter: activeView?.config?.filter,
    baselineSorts: activeView?.config?.sorts,
  });

  // Render view: baseline merged with any local draft. Passed to
  // `useBaseTable` (for table state seeding) and to the toolbar (for badge
  // counts). The real `activeView` is still used as the auto-persist
  // baseline so drafts can't leak into column-layout writes.
  const effectiveView = useMemo(
    () =>
      activeView
        ? {
            ...activeView,
            config: {
              ...activeView.config,
              filter: effectiveFilter,
              sorts: effectiveSorts,
            },
          }
        : undefined,
    [activeView, effectiveFilter, effectiveSorts],
  );

  // Effective values drive the row query and the client-side position
  // sort guard below. The old `activeView.config` reads are no longer the
  // source of truth once drafts are involved.
  const activeFilter = effectiveFilter;
  const activeSorts = effectiveSorts;

  // `useSpaceQuery` is guarded by `enabled: !!spaceId` internally, so
  // passing `""` when `base` hasn't loaded yet is safe. See
  // use-history-restore.tsx for the same pattern.
  const { data: space } = useSpaceQuery(base?.spaceId ?? "");
  const spaceAbility = useSpaceAbility(space?.membership?.permissions);
  const canSave = spaceAbility.can(
    SpaceCaslAction.Edit,
    SpaceCaslSubject.Base,
  );

  // Hold the rows query until `base` has loaded. Otherwise the query
  // fires once with `activeFilter` / `activeSorts` still undefined
  // (a "bland" list request), then fires a second time as soon as the
  // active view's config resolves — doubling network traffic on every
  // base open for any view that has sort or filter.
  const { data: rowsData, isLoading: rowsLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useBaseRowsQuery(base ? baseId : undefined, activeFilter, activeSorts);

  const updateRowMutation = useUpdateRowMutation();
  const createRowMutation = useCreateRowMutation();
  const reorderRowMutation = useReorderRowMutation();
  const createViewMutation = useCreateViewMutation();
  const updateViewMutation = useUpdateViewMutation();

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
    // When a sort is active, the server returns rows in the requested
    // sort order via keyset pagination. Re-sorting by `position` on the
    // client would override that with fractional-index order — visibly
    // breaking the sort as more pages load. Only apply the position
    // sort when no view sort is active (where it keeps
    // optimistically-created and ws-pushed rows in place without a
    // refetch).
    if (activeSorts && activeSorts.length > 0) {
      return flat;
    }
    return flat.sort((a, b) =>
      a.position < b.position ? -1 : a.position > b.position ? 1 : 0,
    );
  }, [rowsData, activeSorts]);

  const { table, persistViewConfig } = useBaseTable(base, rows, effectiveView, {
    baselineConfig: activeView?.config,
  });

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

  const handleDraftSortsChange = useCallback(
    (sorts: ViewSortConfig[] | undefined) => {
      setDraftSorts(sorts && sorts.length > 0 ? sorts : undefined);
    },
    [setDraftSorts],
  );

  const handleDraftFiltersChange = useCallback(
    (filter: FilterGroup | undefined) => {
      setDraftFilter(filter);
    },
    [setDraftFilter],
  );

  const handleSaveDraft = useCallback(async () => {
    if (!activeView || !base) return;
    // `buildPromotedConfig` preserves all non-draft baseline fields
    // (widths/order/visibility) and only overwrites filter/sorts when the
    // draft has divergent values.
    const config = buildPromotedConfig(activeView.config);
    try {
      await updateViewMutation.mutateAsync({
        viewId: activeView.id,
        baseId: base.id,
        config,
      });
      resetDraft();
      notifications.show({ message: t("View updated for everyone") });
    } catch {
      // `useUpdateViewMutation` already shows a red toast on error and
      // rolls back the optimistic cache; keep the draft so the user can
      // retry without re-typing.
    }
  }, [
    activeView,
    base,
    buildPromotedConfig,
    resetDraft,
    t,
    updateViewMutation,
  ]);

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
    return <BaseTableSkeleton />;
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
      <BaseViewDraftBanner
        isDirty={isDirty}
        canSave={canSave}
        onReset={resetDraft}
        onSave={handleSaveDraft}
        saving={updateViewMutation.isPending}
      />
      <BaseToolbar
        base={base}
        activeView={effectiveView}
        views={views}
        table={table}
        onViewChange={handleViewChange}
        onAddView={handleAddView}
        onPersistViewConfig={persistViewConfig}
        onDraftSortsChange={handleDraftSortsChange}
        onDraftFiltersChange={handleDraftFiltersChange}
      />
      <GridContainer
        table={table}
        properties={base.properties}
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
