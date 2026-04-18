import { memo } from "react";
import { Table, ColumnOrderState } from "@tanstack/react-table";
import { IBaseRow } from "@/features/base/types/base.types";
import { GridHeaderCell } from "./grid-header-cell";
import { CreatePropertyPopover } from "@/features/base/components/property/create-property-popover";
import classes from "@/features/base/styles/grid.module.css";

type GridHeaderProps = {
  table: Table<IBaseRow>;
  baseId?: string;
  // Passed explicitly to break memo when columns change
  // (table ref is stable from useReactTable, so memo won't fire without this)
  columnOrder: ColumnOrderState;
  loadedRowIds: string[];
  onPropertyCreated?: () => void;
};

export const GridHeader = memo(function GridHeader({
  table,
  baseId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  columnOrder: _columnOrder,
  loadedRowIds,
  onPropertyCreated,
}: GridHeaderProps) {
  const headerGroups = table.getHeaderGroups();

  return (
    <div className={classes.headerRow} role="row">
      {headerGroups[0]?.headers.map((header) => (
        <GridHeaderCell key={header.id} header={header} loadedRowIds={loadedRowIds} />
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
