import { memo, useCallback } from "react";
import { Table } from "@tanstack/react-table";
import { IBaseRow } from "@/features/base/types/base.types";
import { GridHeaderCell } from "./grid-header-cell";
import { IconPlus } from "@tabler/icons-react";
import classes from "@/features/base/styles/grid.module.css";

type GridHeaderProps = {
  table: Table<IBaseRow>;
  onAddColumn?: () => void;
};

export const GridHeader = memo(function GridHeader({
  table,
  onAddColumn,
}: GridHeaderProps) {
  const headerGroups = table.getHeaderGroups();

  const handleAddColumn = useCallback(() => {
    onAddColumn?.();
  }, [onAddColumn]);

  return (
    <div className={classes.headerRow} role="row">
      {headerGroups[0]?.headers.map((header) => (
        <GridHeaderCell key={header.id} header={header} />
      ))}
      {onAddColumn && (
        <div
          className={classes.addColumnButton}
          onClick={handleAddColumn}
          role="button"
          tabIndex={0}
        >
          <IconPlus size={16} />
        </div>
      )}
    </div>
  );
});
