import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, Stack } from "@mantine/core";
import { useAtom } from "jotai";
import { IconDatabase } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { notifications } from "@mantine/notifications";
import { reorder } from "@atlaskit/pragmatic-drag-and-drop/reorder";
import { generateJitteredKeyBetween } from "fractional-indexing-jittered";
import { useBaseQuery } from "@/features/base/queries/base-query";
import { useBaseSocket } from "@/features/base/hooks/use-base-socket";
import {
  FilterGroup,
  ViewSortConfig,
} from "@/features/base/types/base.types";
import {
  useBaseRowsQuery,
  useBaseRowsCountQuery,
  flattenRows,
  useCreateRowMutation,
  useUpdateRowMutation,
  useReorderRowMutation,
} from "@/features/base/queries/base-row-query";
import {
  useCreateViewMutation,
  useUpdateViewMutation,
} from "@/features/base/queries/base-view-query";
import { activeViewIdAtomFamily } from "@/features/base/atoms/base-atoms";
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
import { BaseToolbar } from "@/features/base/components/base-toolbar";
import { BaseViewDraftBanner } from "@/features/base/components/base-view-draft-banner";
import { BaseTableSkeleton } from "@/features/base/components/base-table-skeleton";
import { ViewRenderer } from "@/features/base/components/views/view-renderer";
import { useRowDetailModal } from "@/features/base/hooks/use-row-detail-modal";
import { RowDetailModal } from "@/features/base/components/row-detail-modal/row-detail-modal";
import classes from "@/features/base/styles/grid.module.css";

type BaseViewProps = {
  pageId: string;
  embedded?: boolean;
};

export function BaseView({ pageId, embedded }: BaseViewProps) {
  const { t } = useTranslation();
  // Subscribe to the base's realtime room so other clients' edits,
  // schema changes, and async-job completions reconcile into our cache.
  useBaseSocket(pageId);
  const { data: base, isLoading: baseLoading, error: baseError } =
    useBaseQuery(pageId);

  const [activeViewId, setActiveViewId] = useAtom(
    activeViewIdAtomFamily(pageId),
  ) as unknown as [string | null, (val: string | null) => void];

  const views = base?.views ?? [];
  const activeView = useMemo(() => {
    if (!views.length) return undefined;
    return views.find((v) => v.id === activeViewId) ?? views[0];
  }, [views, activeViewId]);

  const { data: currentUser } = useCurrentUser();
  const {
    effectiveFilter,
    effectiveSorts,
    isDirty,
    setFilter: setDraftFilter,
    setSorts: setDraftSorts,
    reset: resetDraft,
    buildPromotedConfig,
  } = useViewDraft({
    userId: currentUser?.user.id,
    pageId,
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
  // Bases are pages — gate save on the same Page subject the rest of
  // the app uses; the dedicated Base subject was redundant.
  const canSave = spaceAbility.can(
    SpaceCaslAction.Edit,
    SpaceCaslSubject.Page,
  );

  // Hold the rows query until `base` has loaded. Otherwise the query
  // fires once with `activeFilter` / `activeSorts` still undefined
  // (a "bland" list request), then fires a second time as soon as the
  // active view's config resolves — doubling network traffic on every
  // base open for any view that has sort or filter.
  const {
    data: rowsData,
    isLoading: rowsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useBaseRowsQuery(base ? pageId : undefined, activeFilter, activeSorts);

  // Fire the count request alongside the rows query. Not rendered yet —
  // this mounts the query so its cache is warm for when the toolbar
  // consumes it. Gate on `currentUser` too so `useViewDraft` has had a
  // chance to hydrate the persisted draft from localStorage; otherwise
  // the first post-refresh count would race ahead of the user's saved
  // filter and fire with baseline-only (or nothing).
  const canFetchCount = !!base && !!currentUser;
  useBaseRowsCountQuery(canFetchCount ? pageId : undefined, activeFilter);

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

  const { clear: clearSelection } = useRowSelection(pageId);
  useEffect(() => {
    clearSelection();
  }, [pageId, activeView?.id, clearSelection]);

  // Track the scrollport element in state (not a ref) so the virtualizer's
  // `_willUpdate` re-runs when the div attaches on first mount. Reading
  // `scrollportRef.current` during render would always be null on the
  // render that mounts the div, and no subsequent render is guaranteed —
  // particularly after a filter change, where the scrollport remounts via
  // the `rowsLoading` skeleton path. The virtualizer would then sit on
  // `scrollElement=null`, render zero items, and only recover when
  // something else forced a re-render (e.g. switching views).
  const [scrollportEl, setScrollportEl] = useState<HTMLDivElement | null>(null);

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

  const isKanban = effectiveView?.type === "kanban";

  const handleCellUpdate = useCallback(
    (rowId: string, propertyId: string, value: unknown) => {
      updateRowMutation.mutate({
        rowId,
        pageId,
        cells: { [propertyId]: value },
      });
    },
    [pageId, updateRowMutation],
  );

  const handleAddRow = useCallback(() => {
    createRowMutation.mutate({ pageId });
  }, [pageId, createRowMutation]);

  const handleViewChange = useCallback(
    (viewId: string) => {
      setActiveViewId(viewId);
    },
    [setActiveViewId],
  );

  const handleAddView = useCallback(() => {
    createViewMutation.mutate({
      pageId,
      name: t("New view"),
      type: "table",
    });
  }, [pageId, createViewMutation, t]);

  const handleColumnReorder = useCallback(
    (columnId: string, finishIndex: number) => {
      const order = table.getState().columnOrder;
      const startIndex = order.indexOf(columnId);
      if (startIndex === -1 || startIndex === finishIndex) return;
      table.setColumnOrder(reorder({ list: order, startIndex, finishIndex }));
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
        pageId: base.id,
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

  const { openRowId, openRow, closeRow } = useRowDetailModal();
  const handleCardClick = useCallback(
    (rowId: string) => openRow(rowId),
    [openRow],
  );

  const handleRowReorder = useCallback(
    (rowId: string, targetRowId: string, dropPosition: "above" | "below") => {
      const remainingRows = rows.filter((r) => r.id !== rowId);
      const targetIndex = remainingRows.findIndex((r) => r.id === targetRowId);
      if (targetIndex === -1) return;

      let lowerPos: string | null = null;
      let upperPos: string | null = null;
      if (dropPosition === "above") {
        lowerPos =
          targetIndex > 0 ? remainingRows[targetIndex - 1]?.position : null;
        upperPos = remainingRows[targetIndex]?.position ?? null;
      } else {
        lowerPos = remainingRows[targetIndex]?.position ?? null;
        upperPos =
          targetIndex < remainingRows.length - 1
            ? remainingRows[targetIndex + 1]?.position
            : null;
      }

      try {
        let newPosition: string;
        if (lowerPos && upperPos && lowerPos === upperPos) {
          newPosition = generateJitteredKeyBetween(lowerPos, null);
        } else {
          newPosition = generateJitteredKeyBetween(lowerPos, upperPos);
        }
        reorderRowMutation.mutate({ rowId, pageId, position: newPosition });
      } catch {
        // Position computation failed — skip silently.
      }
    },
    [rows, pageId, reorderRowMutation],
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

  const banner = (
    <BaseViewDraftBanner
      isDirty={isDirty}
      canSave={canSave}
      onReset={resetDraft}
      onSave={handleSaveDraft}
      saving={updateViewMutation.isPending}
    />
  );

  const toolbar = (
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
  );

  if (embedded) {
    // Inline: banner + toolbar live inside the StickyBand (passed via
    // stickyBandPrelude). The page is the vertical scroll container.
    return (
      <>
        <ViewRenderer
          base={base}
          rows={rows}
          effectiveView={effectiveView}
          table={table}
          pageId={pageId}
          embedded={embedded}
          hasNextPage={!!hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onFetchNextPage={fetchNextPage}
          onCellUpdate={handleCellUpdate}
          onAddRow={handleAddRow}
          onColumnReorder={handleColumnReorder}
          onResizeEnd={handleResizeEnd}
          onRowReorder={handleRowReorder}
          onCardClick={handleCardClick}
          persistViewConfig={persistViewConfig}
          scrollportEl={scrollportEl}
          stickyBandPrelude={
            <>
              {banner}
              {toolbar}
            </>
          }
        />
        <RowDetailModal
          base={base}
          rows={rows}
          openRowId={openRowId}
          canEdit={canSave}
          onClose={closeRow}
        />
      </>
    );
  }

  // Standalone: banner + toolbar sit above the .tableScrollport, which
  // is the vertical scroll container. StickyBand inside contains only
  // the column-header row.
  return (
    <>
      <div
        style={{ display: "flex", flexDirection: "column", height: "100%" }}
      >
        {banner}
        {toolbar}
        {isKanban ? (
          <div
            ref={setScrollportEl}
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <ViewRenderer
              base={base}
              rows={rows}
              effectiveView={effectiveView}
              table={table}
              pageId={pageId}
              embedded={embedded}
              hasNextPage={!!hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              onFetchNextPage={fetchNextPage}
              onCellUpdate={handleCellUpdate}
              onAddRow={handleAddRow}
              onColumnReorder={handleColumnReorder}
              onResizeEnd={handleResizeEnd}
              onRowReorder={handleRowReorder}
              onCardClick={handleCardClick}
              persistViewConfig={persistViewConfig}
              scrollportEl={scrollportEl}
            />
          </div>
        ) : (
          <div className={classes.tableScrollport} ref={setScrollportEl}>
            <ViewRenderer
              base={base}
              rows={rows}
              effectiveView={effectiveView}
              table={table}
              pageId={pageId}
              embedded={embedded}
              hasNextPage={!!hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              onFetchNextPage={fetchNextPage}
              onCellUpdate={handleCellUpdate}
              onAddRow={handleAddRow}
              onColumnReorder={handleColumnReorder}
              onResizeEnd={handleResizeEnd}
              onRowReorder={handleRowReorder}
              onCardClick={handleCardClick}
              persistViewConfig={persistViewConfig}
              scrollportEl={scrollportEl}
            />
          </div>
        )}
      </div>
      <RowDetailModal
        base={base}
        rows={rows}
        openRowId={openRowId}
        canEdit={canSave}
        onClose={closeRow}
      />
    </>
  );
}
