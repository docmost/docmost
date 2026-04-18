import { memo, useMemo } from "react";
import { Checkbox, Tooltip } from "@mantine/core";
import { useRowSelection } from "@/features/base/hooks/use-row-selection";
import classes from "@/features/base/styles/grid.module.css";

type RowNumberHeaderCellProps = {
  loadedRowIds: string[];
};

export const RowNumberHeaderCell = memo(function RowNumberHeaderCell({
  loadedRowIds,
}: RowNumberHeaderCellProps) {
  const { selectedIds, toggleAll } = useRowSelection();

  const { checked, indeterminate } = useMemo(() => {
    if (loadedRowIds.length === 0) {
      return { checked: false, indeterminate: false };
    }
    const selectedInLoaded = loadedRowIds.reduce(
      (acc, id) => (selectedIds.has(id) ? acc + 1 : acc),
      0,
    );
    return {
      checked: selectedInLoaded === loadedRowIds.length,
      indeterminate:
        selectedInLoaded > 0 && selectedInLoaded < loadedRowIds.length,
    };
  }, [loadedRowIds, selectedIds]);

  if (loadedRowIds.length === 0) return null;

  return (
    <div className={classes.rowNumberHeaderInner}>
      <span className={classes.rowNumberHeaderHash}>#</span>
      <span className={classes.rowNumberHeaderCheckbox}>
        <Tooltip label="Select all loaded rows" withinPortal>
          <Checkbox
            size="xs"
            checked={checked}
            indeterminate={indeterminate}
            onChange={() => toggleAll(loadedRowIds)}
            aria-label="Select all loaded rows"
          />
        </Tooltip>
      </span>
    </div>
  );
});
