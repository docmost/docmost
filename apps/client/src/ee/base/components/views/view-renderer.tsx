import { Table } from "@tanstack/react-table";
import {
  IBase,
  IBaseRow,
  IBaseView,
  FilterGroup,
} from "@/ee/base/types/base.types";
import { BaseTable } from "@/ee/base/components/base-table";
import { BaseKanban } from "@/ee/base/components/kanban/base-kanban";

type ViewRendererProps = {
  base: IBase;
  rows: IBaseRow[];
  effectiveView: IBaseView | undefined;
  table: Table<IBaseRow>;
  pageId: string;
  embedded?: boolean;
  editable: boolean;
  isFiltered: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onFetchNextPage: () => void;
  onCellUpdate: (rowId: string, propertyId: string, value: unknown) => void;
  onAddRow: (afterRowId?: string, focusPropertyId?: string) => void;
  onColumnReorder: (columnId: string, finishIndex: number) => void;
  onResizeEnd: () => void;
  onRowReorder: (
    rowId: string,
    targetRowId: string,
    dropPosition: "above" | "below",
  ) => void;
  persistViewConfig: () => void;
  scrollportRef: React.RefObject<HTMLDivElement>;
  aboveBand?: React.ReactNode;
  kanbanFilter?: FilterGroup | undefined;
};

export function ViewRenderer(props: ViewRendererProps) {
  const viewType = props.effectiveView?.type ?? "table";

  if (viewType === "kanban") {
    return (
      <BaseKanban
        base={props.base}
        view={props.effectiveView!}
        pageId={props.pageId}
        embedded={props.embedded}
        editable={props.editable}
        viewFilter={props.kanbanFilter}
      />
    );
  }

  if (viewType === "table") {
    return <BaseTable {...props} />;
  }

  return <BaseTable {...props} />;
}
