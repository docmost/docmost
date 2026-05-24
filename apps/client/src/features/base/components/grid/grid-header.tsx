import { memo, useMemo } from "react";
import { Table, ColumnOrderState, VisibilityState } from "@tanstack/react-table";
import { IBaseRow, IBaseProperty } from "@/features/base/types/base.types";
import { GridHeaderCell } from "./grid-header-cell";
import { CreatePropertyPopover } from "@/features/base/components/property/create-property-popover";
import classes from "@/features/base/styles/grid.module.css";

type GridHeaderProps = {
  table: Table<IBaseRow>;
  pageId: string;
  columnOrder: ColumnOrderState;
  columnVisibility: VisibilityState;
  properties: IBaseProperty[];
  loadedRowIds: string[];
  onPropertyCreated?: () => void;
  getColumnOrder: () => string[];
  onColumnReorder?: (columnId: string, finishIndex: number) => void;
};

export const GridHeader = memo(function GridHeader({
  table,
  pageId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  columnOrder: _columnOrder,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  columnVisibility: _columnVisibility,
  properties,
  loadedRowIds,
  onPropertyCreated,
  getColumnOrder,
  onColumnReorder,
}: GridHeaderProps) {
  const headerGroups = table.getHeaderGroups();
  const propertyById = useMemo(() => {
    const map = new Map<string, IBaseProperty>();
    for (const p of properties) map.set(p.id, p);
    return map;
  }, [properties]);

  return (
    <div className={classes.headerRow} role="row">
      {headerGroups[0]?.headers.map((header) => (
        <GridHeaderCell
          key={header.id}
          header={header}
          property={propertyById.get(header.column.id)}
          loadedRowIds={loadedRowIds}
          pageId={pageId}
          getColumnOrder={getColumnOrder}
          onColumnReorder={onColumnReorder}
        />
      ))}
      <CreatePropertyPopover
        pageId={pageId}
        properties={properties}
        onPropertyCreated={onPropertyCreated}
      />
    </div>
  );
});
