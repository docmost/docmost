import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { ActionIcon, Tooltip, Badge } from "@mantine/core";
import { Table } from "@tanstack/react-table";
import {
  IconSortAscending,
  IconFilter,
  IconEye,
  IconDownload,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  IBase,
  IBaseRow,
  IBaseView,
  ViewSortConfig,
  FilterCondition,
  FilterGroup,
} from "@/features/base/types/base.types";
import { useUpdateViewMutation } from "@/features/base/queries/base-view-query";
import { buildViewConfigFromTable } from "@/features/base/hooks/use-base-table";
import { exportBaseToCsv } from "@/features/base/services/base-service";
import { ViewTabs } from "@/features/base/components/views/view-tabs";
import { ViewSortConfigPopover } from "@/features/base/components/views/view-sort-config";
import { ViewFilterConfigPopover } from "@/features/base/components/views/view-filter-config";
import { ViewFieldVisibility } from "@/features/base/components/views/view-field-visibility";
import { useTranslation } from "react-i18next";
import classes from "@/features/base/styles/grid.module.css";

type BaseToolbarProps = {
  base: IBase;
  activeView: IBaseView | undefined;
  views: IBaseView[];
  table: Table<IBaseRow>;
  onViewChange: (viewId: string) => void;
  onAddView?: () => void;
  onPersistViewConfig: () => void;
};

export function BaseToolbar({
  base,
  activeView,
  views,
  table,
  onViewChange,
  onAddView,
  onPersistViewConfig,
}: BaseToolbarProps) {
  const { t } = useTranslation();
  const [sortOpened, setSortOpened] = useState(false);
  const [filterOpened, setFilterOpened] = useState(false);
  const [fieldsOpened, setFieldsOpened] = useState(false);
  const [exporting, setExporting] = useState(false);
  const toolbarRightRef = useRef<HTMLDivElement>(null);

  // Mantine `<Popover>`'s built-in dismiss handlers don't fire reliably
  // for the toolbar popovers (same issue that drove the property menu to
  // use custom listeners in `grid-container.tsx`). Close any open toolbar
  // popover on outside mousedown AND on ESC.
  useEffect(() => {
    if (!sortOpened && !filterOpened && !fieldsOpened) return;
    const closeAll = () => {
      setSortOpened(false);
      setFilterOpened(false);
      setFieldsOpened(false);
    };
    const mouseHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (toolbarRightRef.current?.contains(target)) return;
      if (target.closest('[role="dialog"]')) return;
      closeAll();
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    const id = setTimeout(() => {
      document.addEventListener("mousedown", mouseHandler);
    }, 0);
    document.addEventListener("keydown", keyHandler);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", mouseHandler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [sortOpened, filterOpened, fieldsOpened]);

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportBaseToCsv(base.id);
    } catch (err) {
      notifications.show({
        color: "red",
        message: t("Failed to export CSV"),
      });
    } finally {
      setExporting(false);
    }
  }, [base.id, exporting, t]);

  const openToolbar = useCallback((panel: "sort" | "filter" | "fields") => {
    setSortOpened(panel === "sort" ? (v) => !v : false);
    setFilterOpened(panel === "filter" ? (v) => !v : false);
    setFieldsOpened(panel === "fields" ? (v) => !v : false);
  }, []);

  const updateViewMutation = useUpdateViewMutation();

  const sorts = activeView?.config?.sorts ?? [];
  // Stored view config uses the engine's filter tree. The popover edits
  // an AND-only flat list; we unwrap the top-level group's children when
  // reading and rewrap on save.
  const conditions = useMemo<FilterCondition[]>(() => {
    const filter = activeView?.config?.filter;
    if (!filter || filter.op !== "and") return [];
    return filter.children.filter(
      (c): c is FilterCondition => !("children" in c),
    );
  }, [activeView?.config?.filter]);

  const hiddenFieldCount = useMemo(() => {
    const cols = table.getAllLeafColumns().filter((col) => col.id !== "__row_number");
    return cols.filter((col) => col.getCanHide() && !col.getIsVisible()).length;
  }, [table, table.getState().columnVisibility]);

  const handleSortsChange = useCallback(
    (newSorts: ViewSortConfig[]) => {
      if (!activeView) return;
      const config = buildViewConfigFromTable(table, activeView.config, {
        sorts: newSorts,
      });
      updateViewMutation.mutate({
        viewId: activeView.id,
        baseId: base.id,
        config,
      });
    },
    [activeView, base.id, table, updateViewMutation],
  );

  const handleFiltersChange = useCallback(
    (newConditions: FilterCondition[]) => {
      if (!activeView) return;
      const filter: FilterGroup | undefined =
        newConditions.length > 0
          ? { op: "and", children: newConditions }
          : undefined;
      // `filter: undefined` in overrides removes the filter key; the helper's
      // spread-then-overrides order means `undefined` wins over any base filter.
      const config = buildViewConfigFromTable(table, activeView.config, {
        filter,
      });
      updateViewMutation.mutate({
        viewId: activeView.id,
        baseId: base.id,
        config,
      });
    },
    [activeView, base.id, table, updateViewMutation],
  );

  return (
    <div className={classes.toolbar}>
      <ViewTabs
        views={views}
        activeViewId={activeView?.id}
        baseId={base.id}
        onViewChange={onViewChange}
        onAddView={onAddView}
      />

      <div className={classes.toolbarRight} ref={toolbarRightRef}>
        <Tooltip label={t("Export CSV")}>
          <ActionIcon
            variant="subtle"
            size="sm"
            color="gray"
            loading={exporting}
            onClick={handleExport}
          >
            <IconDownload size={16} />
          </ActionIcon>
        </Tooltip>

        <ViewFilterConfigPopover
          opened={filterOpened}
          onClose={() => setFilterOpened(false)}
          conditions={conditions}
          properties={base.properties}
          onChange={handleFiltersChange}
        >
          <Tooltip label={t("Filter")}>
            <ActionIcon
              variant="subtle"
              size="sm"
              color={conditions.length > 0 ? "blue" : "gray"}
              onClick={() => openToolbar("filter")}
            >
              <IconFilter size={16} />
              {conditions.length > 0 && (
                <Badge
                  size="xs"
                  circle
                  color="blue"
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    padding: 0,
                    width: 14,
                    height: 14,
                    minWidth: 14,
                    fontSize: 9,
                  }}
                >
                  {conditions.length}
                </Badge>
              )}
            </ActionIcon>
          </Tooltip>
        </ViewFilterConfigPopover>

        <ViewSortConfigPopover
          opened={sortOpened}
          onClose={() => setSortOpened(false)}
          sorts={sorts}
          properties={base.properties}
          onChange={handleSortsChange}
        >
          <Tooltip label={t("Sort")}>
            <ActionIcon
              variant="subtle"
              size="sm"
              color={sorts.length > 0 ? "blue" : "gray"}
              onClick={() => openToolbar("sort")}
            >
              <IconSortAscending size={16} />
              {sorts.length > 0 && (
                <Badge
                  size="xs"
                  circle
                  color="blue"
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    padding: 0,
                    width: 14,
                    height: 14,
                    minWidth: 14,
                    fontSize: 9,
                  }}
                >
                  {sorts.length}
                </Badge>
              )}
            </ActionIcon>
          </Tooltip>
        </ViewSortConfigPopover>

        <ViewFieldVisibility
          opened={fieldsOpened}
          onClose={() => setFieldsOpened(false)}
          table={table}
          properties={base.properties}
          onPersist={onPersistViewConfig}
        >
          <Tooltip label={t("Hide fields")}>
            <ActionIcon
              variant="subtle"
              size="sm"
              color={hiddenFieldCount > 0 ? "blue" : "gray"}
              onClick={() => openToolbar("fields")}
            >
              <IconEye size={16} />
              {hiddenFieldCount > 0 && (
                <Badge
                  size="xs"
                  circle
                  color="blue"
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    padding: 0,
                    width: 14,
                    height: 14,
                    minWidth: 14,
                    fontSize: 9,
                  }}
                >
                  {hiddenFieldCount}
                </Badge>
              )}
            </ActionIcon>
          </Tooltip>
        </ViewFieldVisibility>
      </div>
    </div>
  );
}
