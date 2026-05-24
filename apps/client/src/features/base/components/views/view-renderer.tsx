import { Table } from "@tanstack/react-table";
import {
  IBase,
  IBaseRow,
  IBaseView,
} from "@/features/base/types/base.types";
import { BaseTable } from "@/features/base/components/base-table";

type ViewRendererProps = {
  base: IBase;
  rows: IBaseRow[];
  effectiveView: IBaseView | undefined;
  table: Table<IBaseRow>;
  pageId: string;
  embedded?: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onFetchNextPage: () => void;
  onCellUpdate: (rowId: string, propertyId: string, value: unknown) => void;
  onAddRow: () => void;
  onColumnReorder: (columnId: string, finishIndex: number) => void;
  onResizeEnd: () => void;
  onRowReorder: (
    rowId: string,
    targetRowId: string,
    dropPosition: "above" | "below",
  ) => void;
  persistViewConfig: () => void;
  scrollportRef: React.RefObject<HTMLDivElement>;
  stickyBandPrelude?: React.ReactNode;
};

export function ViewRenderer(props: ViewRendererProps) {
  const viewType = props.effectiveView?.type ?? "table";

  if (viewType === "table") {
    return <BaseTable {...props} />;
  }

  // Kanban added in a later task; until then, fall back to the table so
  // selecting a kanban view never produces a blank page.
  return <BaseTable {...props} />;
}
