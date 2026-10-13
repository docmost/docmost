import { useCallback, useEffect, useMemo, useRef } from "react";
import { Text, Stack } from "@mantine/core";
import { useAtom } from "jotai";
import { IconTable } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { notifications } from "@mantine/notifications";
import { reorder } from "@atlaskit/pragmatic-drag-and-drop/reorder";
import { generateJitteredKeyBetween } from "fractional-indexing-jittered";
import { useBaseQuery } from "@/ee/base/queries/base-query";
import { useBaseSocket } from "@/ee/base/hooks/use-base-socket";
import {
  FilterGroup,
  ViewSortConfig,
  EditingCell,
  FocusedCell,
  IBaseProperty,
} from "@/ee/base/types/base.types";
import {
  useBaseRowsQuery,
  flattenRows,
  useCreateRowMutation,
  useUpdateRowMutation,
  useReorderRowMutation,
} from "@/ee/base/queries/base-row-query";
import { useUpdateViewMutation } from "@/ee/base/queries/base-view-query";
import {
  activeViewIdAtomFamily,
  editingCellAtomFamily,
  focusedCellAtomFamily,
} from "@/ee/base/atoms/base-atoms";
import { useBaseTable } from "@/ee/base/hooks/use-base-table";
import { isSystemPropertyType } from "@/ee/base/property-types/property-type.registry";
import { useRowSelection } from "@/ee/base/hooks/use-row-selection";
import useCurrentUser from "@/features/user/hooks/use-current-user";
import { useHydrateCurrentUser } from "@/ee/base/reference/reference-store";
import { useViewDraft } from "@/ee/base/hooks/use-view-draft";
import { BaseToolbar } from "@/ee/base/components/base-toolbar";
import { BaseViewDraftBanner } from "@/ee/base/components/base-view-draft-banner";
import { BaseEmbedTitle } from "@/ee/base/components/base-embed-title";
import { BaseTableSkeleton } from "@/ee/base/components/base-table-skeleton";
import { ViewRenderer } from "@/ee/base/components/views/view-renderer";
import { RowDetailModal } from "@/ee/base/components/row-detail-modal/row-detail-modal";
import { useRowDetailModal } from "@/ee/base/hooks/use-row-detail-modal";
import { BaseEditableProvider } from "@/ee/base/context/base-editable";
import { RowExpandProvider } from "@/ee/base/context/row-expand";
import { usePageQuery } from "@/features/page/queries/page-query";
import { buildPageUrl } from "@/features/page/page.utils";
import { getAppUrl } from "@/lib/config.ts";
import { useNavigate } from "react-router-dom";
import classes from "@/ee/base/styles/grid.module.css";
import viewClasses from "@/ee/base/styles/base-view.module.css";
import kanbanClasses from "@/ee/base/styles/kanban.module.css";

type BaseViewProps = {
  pageId: string;
  embedded?: boolean;
  /** False makes the view read-only. Standalone passes page.permissions.canEdit;
   *  embedded ANDs that with the host editor's editability. */
  editable?: boolean;
  titleSlot?: React.ReactNode;
};

export function BaseView({ pageId, embedded, editable = true, titleSlot }: BaseViewProps) {
  const { t } = useTranslation();
  // Subscribe so other clients' edits, schema changes, and async-job completions reconcile into cache.
  useBaseSocket(pageId);
  const { data: base, isLoading: baseLoading, error: baseError } =
    useBaseQuery(pageId);

  const navigate = useNavigate();
  const { data: page } = usePageQuery({ pageId });
  const handleExpand = useCallback(() => {
    if (!page) return;
    navigate(buildPageUrl(page.space?.slug, page.slugId, page.title));
  }, [navigate, page]);

  // Share URL for a specific view; always points at the standalone page where ?view= is honored.
  const getViewShareUrl = useCallback(
    (viewId: string) =>
      page
        ? `${getAppUrl()}${buildPageUrl(page.space?.slug, page.slugId, page.title)}?view=${encodeURIComponent(viewId)}`
        : null,
    [page],
  );

  const [activeViewId, setActiveViewId] = useAtom(
    activeViewIdAtomFamily(pageId),
  ) as unknown as [string | null, (val: string | null) => void];

  const [, setEditingCell] = useAtom(
    editingCellAtomFamily(pageId),
  ) as unknown as [EditingCell, (val: EditingCell) => void];

  const [, setFocusedCell] = useAtom(
    focusedCellAtomFamily(pageId),
  ) as unknown as [FocusedCell, (val: FocusedCell) => void];

  const views = useMemo(
    () =>
      [...(base?.views ?? [])].sort((a, b) =>
        a.position < b.position ? -1 : a.position > b.position ? 1 : 0,
      ),
    [base?.views],
  );
  const activeView = useMemo(() => {
    if (!views.length) return undefined;
    return views.find((v) => v.id === activeViewId) ?? views[0];
  }, [views, activeViewId]);

  const { data: currentUser } = useCurrentUser();
  useHydrateCurrentUser(pageId);
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

  // Baseline merged with local draft. Used for table state and toolbar badge counts.
  // The real activeView remains the auto-persist baseline so drafts can't leak into layout writes.
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

  const activeFilter = effectiveFilter;
  const activeSorts = effectiveSorts;

  const canSave = editable;

  // Gate on base to avoid a "bland" list request before the active view's
  // config resolves, which would double network traffic for sorted/filtered views.
  const isKanban = activeView?.type === "kanban";

  const {
    data: rowsData,
    isLoading: rowsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useBaseRowsQuery(base && !isKanban ? pageId : undefined, activeFilter, activeSorts);

  const updateRowMutation = useUpdateRowMutation();
  const createRowMutation = useCreateRowMutation();
  const reorderRowMutation = useReorderRowMutation();
  const updateViewMutation = useUpdateViewMutation();

  useEffect(() => {
    if (activeView && activeViewId !== activeView.id) {
      setActiveViewId(activeView.id);
    }
  }, [activeView, activeViewId, setActiveViewId]);

  // Deep link: apply ?view=<id> once after views load; skip if the id is
  // unrecognised so we fall back to the default without fighting a later tab switch.
  const appliedViewParamRef = useRef(false);
  useEffect(() => {
    if (appliedViewParamRef.current || views.length === 0) return;
    const viewParam = new URLSearchParams(window.location.search).get("view");
    if (viewParam && views.some((v) => v.id === viewParam)) {
      setActiveViewId(viewParam);
    }
    appliedViewParamRef.current = true;
  }, [views, setActiveViewId]);

  const { clear: clearSelection } = useRowSelection(pageId);
  useEffect(() => {
    clearSelection();
  }, [pageId, activeView?.id, clearSelection]);

  const scrollportRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const flat = flattenRows(rowsData);
    // With an active sort the server returns rows in sort order via keyset
    // pagination; re-sorting by position on the client would break it as more
    // pages load. Position sort only applies when no view sort is active.
    if (activeSorts && activeSorts.length > 0) {
      return flat;
    }
    return flat.sort((a, b) =>
      a.position < b.position ? -1 : a.position > b.position ? 1 : 0,
    );
  }, [rowsData, activeSorts]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const { table, persistViewConfig } = useBaseTable(base, rows, effectiveView);

  const guardedPersistViewConfig = useCallback(() => {
    if (!editable) return;
    persistViewConfig();
  }, [editable, persistViewConfig]);

  // Mutation result objects change identity every render; only .mutate is
  // stable. Rows are memoized on these callbacks' identities, so they must
  // not churn with unrelated re-renders.
  const updateRow = updateRowMutation.mutate;
  const handleCellUpdate = useCallback(
    (rowId: string, propertyId: string, value: unknown) => {
      if (!editable) return;
      updateRow({
        rowId,
        pageId,
        cells: { [propertyId]: value },
      });
    },
    [editable, pageId, updateRow],
  );

  const handleAddRow = useCallback(
    (afterRowId?: string, focusPropertyId?: string) => {
      if (!editable) return;
      createRowMutation.mutate(
        { pageId, ...(afterRowId ? { afterRowId } : {}) },
        {
          onSuccess: (newRow) => {
            let propertyId = focusPropertyId;
            if (!propertyId) {
              const firstEditable = table.getVisibleLeafColumns().find((col) => {
                if (col.id === "__row_number") return false;
                const prop = col.columnDef.meta?.property as
                  | IBaseProperty
                  | undefined;
                return (
                  !!prop &&
                  prop.type !== "checkbox" &&
                  !isSystemPropertyType(prop.type)
                );
              });
              propertyId = (
                firstEditable?.columnDef.meta?.property as
                  | IBaseProperty
                  | undefined
              )?.id;
            }
            if (propertyId) {
              setEditingCell({ rowId: newRow.id, propertyId });
              setFocusedCell({ rowId: newRow.id, propertyId });
            }
          },
        },
      );
    },
    [editable, pageId, createRowMutation, table, setEditingCell, setFocusedCell],
  );

  const handleViewChange = useCallback(
    (viewId: string) => {
      setActiveViewId(viewId);
    },
    [setActiveViewId],
  );

  const handleColumnReorder = useCallback(
    (columnId: string, finishIndex: number) => {
      const order = table.getState().columnOrder;
      const startIndex = order.indexOf(columnId);
      if (startIndex === -1 || startIndex === finishIndex) return;
      table.setColumnOrder(reorder({ list: order, startIndex, finishIndex }));
      guardedPersistViewConfig();
    },
    [table, guardedPersistViewConfig],
  );

  const handleResizeEnd = useCallback(() => {
    guardedPersistViewConfig();
  }, [guardedPersistViewConfig]);

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
    // Preserves non-draft baseline fields (widths/order/visibility), overwrites only filter/sorts.
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
      // useUpdateViewMutation shows a toast and rolls back; keep the draft so the user can retry.
    }
  }, [
    activeView,
    base,
    buildPromotedConfig,
    resetDraft,
    t,
    updateViewMutation,
  ]);

  const { openRowId, openRow, closeRow } = useRowDetailModal(pageId);
  // openRow's identity tracks searchParams; rows subscribe to the expand
  // context, so hand them a stable wrapper instead.
  const openRowRef = useRef(openRow);
  openRowRef.current = openRow;
  const handleExpandRow = useCallback((rowId: string) => {
    openRowRef.current(rowId);
  }, []);
  const handleRowNavigate = useCallback((rowId: string) => {
    openRowRef.current(rowId, { replace: true });
  }, []);

  const reorderRow = reorderRowMutation.mutate;
  const handleRowReorder = useCallback(
    (rowId: string, targetRowId: string, dropPosition: "above" | "below") => {
      if (!editable) return;
      const remainingRows = rowsRef.current.filter((r) => r.id !== rowId);
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
        reorderRow({ rowId, pageId, position: newPosition });
      } catch {
        // Position computation failed; skip silently.
      }
    },
    [editable, pageId, reorderRow],
  );

  if (baseLoading || (!isKanban && rowsLoading)) {
    return <BaseTableSkeleton />;
  }
  if (baseError) {
    return (
      <Stack align="center" gap="sm" p="xl">
        <IconTable size={40} color="var(--mantine-color-gray-5)" />
        <Text c="dimmed">{t("Failed to load base")}</Text>
      </Stack>
    );
  }
  if (!base) return null;

  // Ghost rows are an "empty base" affordance, not a "filter matched nothing" state.
  const isFiltered = (activeFilter?.children?.length ?? 0) > 0;

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
      canAddView={editable}
      onPersistViewConfig={guardedPersistViewConfig}
      onDraftSortsChange={handleDraftSortsChange}
      onDraftFiltersChange={handleDraftFiltersChange}
      onExpand={embedded ? handleExpand : undefined}
      getViewShareUrl={getViewShareUrl}
    />
  );

  const kanbanBand = (
    <div className={kanbanClasses.bandWrap}>
      {embedded ? null : titleSlot}
      {banner}
      {toolbar}
      {embedded ? <BaseEmbedTitle pageId={pageId} /> : null}
    </div>
  );

  const viewRenderer = (folded: React.ReactNode) => (
    <ViewRenderer
      base={base}
      rows={rows}
      effectiveView={effectiveView}
      table={table}
      pageId={pageId}
      embedded={embedded}
      editable={editable}
      isFiltered={isFiltered}
      hasNextPage={!!hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onFetchNextPage={fetchNextPage}
      onCellUpdate={handleCellUpdate}
      onAddRow={handleAddRow}
      onColumnReorder={editable ? handleColumnReorder : undefined}
      onResizeEnd={handleResizeEnd}
      onRowReorder={editable ? handleRowReorder : undefined}
      persistViewConfig={guardedPersistViewConfig}
      scrollportRef={scrollportRef}
      kanbanFilter={activeFilter}
      aboveBand={folded}
    />
  );

  if (embedded) {
    if (isKanban) {
      return (
        <BaseEditableProvider editable={editable}>
          <RowExpandProvider value={handleExpandRow}>
            {kanbanBand}
            {viewRenderer(null)}
          </RowExpandProvider>
          <RowDetailModal
            base={base}
            rows={rows}
            openRowId={openRowId}
            onClose={closeRow}
            onNavigate={handleRowNavigate}
          />
        </BaseEditableProvider>
      );
    }

    // Banner and toolbar go into aboveBand so they scroll with the host document;
    // only the column-header row stays pinned (via --sticky-band-top).
    return (
      <BaseEditableProvider editable={editable}>
        <RowExpandProvider value={handleExpandRow}>
          {viewRenderer(
            <>
              {banner}
              {toolbar}
              <BaseEmbedTitle pageId={pageId} />
            </>,
          )}
        </RowExpandProvider>
        <RowDetailModal
          base={base}
          rows={rows}
          openRowId={openRowId}
          onClose={closeRow}
          onNavigate={handleRowNavigate}
        />
      </BaseEditableProvider>
    );
  }

  if (isKanban) {
    return (
      <BaseEditableProvider editable={editable}>
        <div className={kanbanClasses.standalone}>
          <RowExpandProvider value={handleExpandRow}>
            {kanbanBand}
            {viewRenderer(null)}
          </RowExpandProvider>
        </div>
        <RowDetailModal
          base={base}
          rows={rows}
          openRowId={openRowId}
          onClose={closeRow}
          onNavigate={handleRowNavigate}
        />
      </BaseEditableProvider>
    );
  }

  // Standalone: title, banner, and toolbar go in aboveBand inside the scroll
  // container so they scroll away; only the column-header row stays pinned.
  return (
    <BaseEditableProvider editable={editable}>
      <div className={viewClasses.fullHeight}>
        <div className={classes.tableScrollport} ref={scrollportRef}>
          <RowExpandProvider value={handleExpandRow}>
            {viewRenderer(
              <>
                {titleSlot}
                {banner}
                {toolbar}
              </>,
            )}
          </RowExpandProvider>
        </div>
      </div>
      <RowDetailModal
        base={base}
        rows={rows}
        openRowId={openRowId}
        onClose={closeRow}
        onNavigate={handleRowNavigate}
      />
    </BaseEditableProvider>
  );
}
