import { useState, useCallback, useMemo } from "react";
import { ActionIcon, Tooltip, Badge } from "@mantine/core";
import { Table } from "@tanstack/react-table";
import {
  IconSortAscending,
  IconFilter,
  IconEye,
  IconDownload,
  IconArrowsDiagonal,
  IconLayoutColumns,
  IconAdjustments,
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
import { getApiErrorMessage } from "@/lib/api-error";
import { ViewTabs } from "@/ee/base/components/views/view-tabs";
import { ViewSortConfigPopover } from "@/ee/base/components/views/view-sort-config";
import { ViewFilterConfigPopover } from "@/ee/base/components/views/view-filter-config";
import { ViewPropertyVisibility } from "@/ee/base/components/views/view-property-visibility";
import { KanbanGroupByPicker } from "@/ee/base/components/kanban/kanban-group-by-picker";
import { KanbanCardProperties } from "@/ee/base/components/kanban/kanban-card-properties";
import { useTranslation } from "react-i18next";
import classes from "@/ee/base/styles/grid.module.css";
import toolbarClasses from "@/ee/base/styles/base-toolbar.module.css";

type BaseToolbarProps = {
  base: IBase;
  activeView: IBaseView | undefined;
  views: IBaseView[];
  table?: Table<IBaseRow>;
  onViewChange: (viewId: string) => void;
  onAddView?: () => void;
  canAddView?: boolean;
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
  canAddView,
  onPersistViewConfig,
  onDraftSortsChange,
  onDraftFiltersChange,
  onExpand,
  getViewShareUrl,
}: BaseToolbarProps) {
  const { t } = useTranslation();
  const [sortOpened, setSortOpened] = useState(false);
  const [filterOpened, setFilterOpened] = useState(false);
  const [propertiesOpened, setPropertiesOpened] = useState(false);
  const [cardPropertiesOpened, setCardPropertiesOpened] = useState(false);
  const [exporting, setExporting] = useState(false);

  const isKanban = activeView?.type === "kanban";

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportBaseToCsv(base.id);
    } catch (err) {
      notifications.show({
        color: "red",
        message: getApiErrorMessage(err, t("Failed to export CSV")),
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
  const conditions = useMemo<FilterCondition[]>(() => {
    const filter = activeView?.config?.filter;
    if (!filter || filter.op !== "and") return [];
    return filter.children.filter(
      (c): c is FilterCondition => !("children" in c),
    );
  }, [activeView?.config?.filter]);

  const hiddenPropertyCount = useMemo(() => {
    if (!table) return 0;
    const cols = table.getAllLeafColumns().filter((col) => col.id !== "__row_number");
    return cols.filter((col) => col.getCanHide() && !col.getIsVisible()).length;
  }, [table, table?.getState().columnVisibility]);

  const handleSortsChange = useCallback(
    (newSorts: ViewSortConfig[]) => {
      onDraftSortsChange(newSorts.length > 0 ? newSorts : undefined);
    },
    [onDraftSortsChange],
  );

  const handleFiltersChange = useCallback(
    (newConditions: FilterCondition[]) => {
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
        base={base}
        canAddView={canAddView}
        getViewShareUrl={getViewShareUrl}
      />

      <div className={classes.toolbarRight}>
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
                  className={toolbarClasses.badgeDot}
                >
                  {conditions.length}
                </Badge>
              )}
            </ActionIcon>
          </Tooltip>
        </ViewFilterConfigPopover>

        {isKanban && activeView && (
          <>
            <KanbanGroupByPicker base={base} view={activeView} pageId={base.id}>
              <Tooltip label={t("Group by")}>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  color="gray"
                >
                  <IconLayoutColumns size={16} />
                </ActionIcon>
              </Tooltip>
            </KanbanGroupByPicker>

            <KanbanCardProperties
              opened={cardPropertiesOpened}
              onClose={() => setCardPropertiesOpened(false)}
              base={base}
              view={activeView}
              pageId={base.id}
            >
              <Tooltip label={t("Card properties")}>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  color="gray"
                  onClick={() => setCardPropertiesOpened((v) => !v)}
                >
                  <IconAdjustments size={16} />
                </ActionIcon>
              </Tooltip>
            </KanbanCardProperties>
          </>
        )}

        {!isKanban && (
          <>
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

            {table && (
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
            )}
          </>
        )}

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
