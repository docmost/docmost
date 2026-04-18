import { memo, useMemo } from "react";
import { Table, ColumnOrderState } from "@tanstack/react-table";
import { IBaseRow, IBaseProperty } from "@/features/base/types/base.types";
import { GridHeaderCell } from "./grid-header-cell";
import { CreatePropertyPopover } from "@/features/base/components/property/create-property-popover";
import classes from "@/features/base/styles/grid.module.css";

type GridHeaderProps = {
  table: Table<IBaseRow>;
  baseId?: string;
  // Passed explicitly to break memo when columns change
  // (table ref is stable from useReactTable, so memo won't fire without these)
  columnOrder: ColumnOrderState;
  properties: IBaseProperty[];
  loadedRowIds: string[];
  onPropertyCreated?: () => void;
};

export const GridHeader = memo(function GridHeader({
  table,
  baseId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  columnOrder: _columnOrder,
  properties,
  loadedRowIds,
  onPropertyCreated,
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
        />
      ))}
      {baseId && (
        <CreatePropertyPopover
          baseId={baseId}
          onPropertyCreated={onPropertyCreated}
        />
      )}
    </div>
  );
});
