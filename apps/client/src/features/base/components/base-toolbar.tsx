import { useState, useCallback, useMemo } from "react";
import { ActionIcon, Tooltip, Badge } from "@mantine/core";
import { Table } from "@tanstack/react-table";
import {
  IconSortAscending,
  IconFilter,
  IconEye,
} from "@tabler/icons-react";
import {
  IBase,
  IBaseRow,
  IBaseView,
  ViewSortConfig,
  ViewFilterConfig,
} from "@/features/base/types/base.types";
import { useUpdateViewMutation } from "@/features/base/queries/base-view-query";
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

  const openToolbar = useCallback((panel: "sort" | "filter" | "fields") => {
    setSortOpened(panel === "sort" ? (v) => !v : false);
    setFilterOpened(panel === "filter" ? (v) => !v : false);
    setFieldsOpened(panel === "fields" ? (v) => !v : false);
  }, []);

  const updateViewMutation = useUpdateViewMutation();

  const sorts = activeView?.config?.sorts ?? [];
  const filters = activeView?.config?.filters ?? [];

  const hiddenFieldCount = useMemo(() => {
    const cols = table.getAllLeafColumns().filter((col) => col.id !== "__row_number");
    return cols.filter((col) => col.getCanHide() && !col.getIsVisible()).length;
  }, [table, table.getState().columnVisibility]);

  const handleSortsChange = useCallback(
    (newSorts: ViewSortConfig[]) => {
      if (!activeView) return;
      updateViewMutation.mutate({
        viewId: activeView.id,
        baseId: base.id,
        config: { ...activeView.config, sorts: newSorts },
      });
    },
    [activeView, base.id, updateViewMutation],
  );

  const handleFiltersChange = useCallback(
    (newFilters: ViewFilterConfig[]) => {
      if (!activeView) return;
      updateViewMutation.mutate({
        viewId: activeView.id,
        baseId: base.id,
        config: { ...activeView.config, filters: newFilters },
      });
    },
    [activeView, base.id, updateViewMutation],
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

      <div className={classes.toolbarRight}>
        <ViewFilterConfigPopover
          opened={filterOpened}
          onClose={() => setFilterOpened(false)}
          filters={filters}
          properties={base.properties}
          onChange={handleFiltersChange}
        >
          <Tooltip label={t("Filter")}>
            <ActionIcon
              variant="subtle"
              size="sm"
              color={filters.length > 0 ? "blue" : "gray"}
              onClick={() => openToolbar("filter")}
            >
              <IconFilter size={16} />
              {filters.length > 0 && (
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
                  {filters.length}
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
