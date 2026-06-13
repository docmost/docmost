import { useState, useCallback, useMemo } from "react";
import { ActionIcon, Tooltip, Badge } from "@mantine/core";
import { Table } from "@tanstack/react-table";
import {
  IconSortAscending,
  IconFilter,
  IconEye,
  IconDownload,
  IconArrowsDiagonal,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  IBase,
  IBaseRow,
  IBaseView,
  ViewSortConfig,
  FilterCondition,
  FilterGroup,
} from "@/ee/base/types/base.types";
import { exportBaseToCsv } from "@/ee/base/services/base-service";
import { useBaseEditable } from "@/ee/base/context/base-editable";
import { ViewTabs } from "@/ee/base/components/views/view-tabs";
import { ViewSortConfigPopover } from "@/ee/base/components/views/view-sort-config";
import { ViewFilterConfigPopover } from "@/ee/base/components/views/view-filter-config";
import { ViewPropertyVisibility } from "@/ee/base/components/views/view-property-visibility";
import { useTranslation } from "react-i18next";
import classes from "@/ee/base/styles/grid.module.css";
import toolbarClasses from "@/ee/base/styles/base-toolbar.module.css";

type BaseToolbarProps = {
  base: IBase;
  // Effective view (baseline merged with local draft). Badge counts and popover
  // seed data read from this; the real baseline only enters via the draft callbacks.
  activeView: IBaseView | undefined;
  views: IBaseView[];
  table: Table<IBaseRow>;
  onViewChange: (viewId: string) => void;
  onAddView?: () => void;
  onPersistViewConfig: () => void;
  onDraftSortsChange: (sorts: ViewSortConfig[] | undefined) => void;
  onDraftFiltersChange: (filter: FilterGroup | undefined) => void;
  onExpand?: () => void;
  getViewShareUrl?: (viewId: string) => string | null;
};

export function BaseToolbar({
  base,
  activeView,
  views,
  table,
  onViewChange,
  onAddView,
  onPersistViewConfig,
  onDraftSortsChange,
  onDraftFiltersChange,
  onExpand,
  getViewShareUrl,
}: BaseToolbarProps) {
  const { t } = useTranslation();
  const editable = useBaseEditable();
  const [sortOpened, setSortOpened] = useState(false);
  const [filterOpened, setFilterOpened] = useState(false);
  const [propertiesOpened, setPropertiesOpened] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  const openToolbar = useCallback((panel: "sort" | "filter" | "properties") => {
    setSortOpened(panel === "sort" ? (v) => !v : false);
    setFilterOpened(panel === "filter" ? (v) => !v : false);
    setPropertiesOpened(panel === "properties" ? (v) => !v : false);
  }, []);

  const sorts = activeView?.config?.sorts ?? [];
  // The stored filter is a tree; the popover edits an AND-only flat list.
  // Unwrap the top-level group's children when reading, rewrap on save.
  const conditions = useMemo<FilterCondition[]>(() => {
    const filter = activeView?.config?.filter;
    if (!filter || filter.op !== "and") return [];
    return filter.children.filter(
      (c): c is FilterCondition => !("children" in c),
    );
  }, [activeView?.config?.filter]);

  const hiddenPropertyCount = useMemo(() => {
    const cols = table.getAllLeafColumns().filter((col) => col.id !== "__row_number");
    return cols.filter((col) => col.getCanHide() && !col.getIsVisible()).length;
  }, [table, table.getState().columnVisibility]);

  const handleSortsChange = useCallback(
    (newSorts: ViewSortConfig[]) => {
      // Normalize empty to undefined so the draft hook drops the sorts axis.
      onDraftSortsChange(newSorts.length > 0 ? newSorts : undefined);
    },
    [onDraftSortsChange],
  );

  const handleFiltersChange = useCallback(
    (newConditions: FilterCondition[]) => {
      // Wrap the AND-flat list into the engine's FilterGroup shape; undefined drops the axis.
      const filter: FilterGroup | undefined =
        newConditions.length > 0
          ? { op: "and", children: newConditions }
          : undefined;
      onDraftFiltersChange(filter);
    },
    [onDraftFiltersChange],
  );

  return (
    <div className={classes.toolbar}>
      <ViewTabs
        views={views}
        activeViewId={activeView?.id}
        pageId={base.id}
        onViewChange={onViewChange}
        onAddView={onAddView}
        getViewShareUrl={getViewShareUrl}
      />

      <div className={classes.toolbarRight}>
        {editable && (
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
        )}

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
                  className={toolbarClasses.badgeDot}
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
                  className={toolbarClasses.badgeDot}
                >
                  {sorts.length}
                </Badge>
              )}
            </ActionIcon>
          </Tooltip>
        </ViewSortConfigPopover>

        <ViewPropertyVisibility
          opened={propertiesOpened}
          onClose={() => setPropertiesOpened(false)}
          table={table}
          properties={base.properties}
          onPersist={onPersistViewConfig}
        >
          <Tooltip label={t("Hide properties")}>
            <ActionIcon
              variant="subtle"
              size="sm"
              color={hiddenPropertyCount > 0 ? "blue" : "gray"}
              onClick={() => openToolbar("properties")}
            >
              <IconEye size={16} />
              {hiddenPropertyCount > 0 && (
                <Badge
                  size="xs"
                  circle
                  color="blue"
                  className={toolbarClasses.badgeDot}
                >
                  {hiddenPropertyCount}
                </Badge>
              )}
            </ActionIcon>
          </Tooltip>
        </ViewPropertyVisibility>

        {onExpand && (
          <Tooltip label={t("Open as page")}>
            <ActionIcon
              variant="subtle"
              size="sm"
              color="gray"
              onClick={onExpand}
            >
              <IconArrowsDiagonal size={16} />
            </ActionIcon>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
