import { GridContainer } from "@/features/base/components/grid/grid-container";
import { Table } from "@tanstack/react-table";
import {
  IBase,
  IBaseRow,
  IBaseView,
} from "@/features/base/types/base.types";

type BaseTableProps = {
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
  scrollportEl: HTMLDivElement | null;
  stickyBandPrelude?: React.ReactNode;
};

export function BaseTable({
  base,
  rows: _rows,
  table,
  pageId,
  embedded,
  hasNextPage,
  isFetchingNextPage,
  onFetchNextPage,
  onCellUpdate,
  onAddRow,
  onColumnReorder,
  onResizeEnd,
  onRowReorder,
  scrollportEl,
  stickyBandPrelude,
}: BaseTableProps) {
  return (
    <GridContainer
      table={table}
      properties={base.properties}
      onCellUpdate={onCellUpdate}
      onAddRow={onAddRow}
      pageId={pageId}
      onColumnReorder={onColumnReorder}
      onResizeEnd={onResizeEnd}
      onRowReorder={onRowReorder}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onFetchNextPage={onFetchNextPage}
      scrollElement={embedded ? window : scrollportEl}
      stickyBandPrelude={stickyBandPrelude ?? null}
    />
  );
}
