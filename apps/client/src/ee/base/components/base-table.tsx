import { GridContainer } from "@/ee/base/components/grid/grid-container";
import { Table } from "@tanstack/react-table";
import {
  IBase,
  IBaseRow,
  IBaseView,
} from "@/ee/base/types/base.types";

type BaseTableProps = {
  base: IBase;
  rows: IBaseRow[];
  effectiveView: IBaseView | undefined;
  table: Table<IBaseRow>;
  pageId: string;
  embedded?: boolean;
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
};

export function BaseTable({
  base,
  rows: _rows,
  table,
  pageId,
  embedded,
  isFiltered,
  hasNextPage,
  isFetchingNextPage,
  onFetchNextPage,
  onCellUpdate,
  onAddRow,
  onColumnReorder,
  onResizeEnd,
  onRowReorder,
  scrollportRef,
  aboveBand,
}: BaseTableProps) {
  return (
    <GridContainer
      table={table}
      properties={base.properties}
      onCellUpdate={onCellUpdate}
      onAddRow={onAddRow}
      pageId={pageId}
      isFiltered={isFiltered}
      onColumnReorder={onColumnReorder}
      onResizeEnd={onResizeEnd}
      onRowReorder={onRowReorder}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onFetchNextPage={onFetchNextPage}
      scrollElement={embedded ? window : scrollportRef.current}
      aboveBand={aboveBand ?? null}
    />
  );
}
