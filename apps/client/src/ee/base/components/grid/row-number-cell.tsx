import { memo, useCallback } from "react";
import { Checkbox } from "@mantine/core";
import { IconGripVertical } from "@tabler/icons-react";
import { useRowSelection } from "@/ee/base/hooks/use-row-selection";
import { useBaseEditable } from "@/ee/base/context/base-editable";
import { useGridRowOrder } from "@/ee/base/context/grid-row-order";
import classes from "@/ee/base/styles/grid.module.css";

type RowNumberCellProps = {
  rowId: string;
  rowIndex: number;
  isPinned: boolean;
  pinOffset?: number;
  pageId: string;
};

export const RowNumberCell = memo(function RowNumberCell({
  rowId,
  rowIndex,
  isPinned,
  pinOffset,
  pageId,
}: RowNumberCellProps) {
  const { isSelected, toggle } = useRowSelection(pageId);
  const selected = isSelected(rowId);
  const editable = useBaseEditable();
  const getOrderedRowIds = useGridRowOrder();

  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const nativeEvent = e.nativeEvent as MouseEvent;
      toggle(rowId, {
        shiftKey: nativeEvent.shiftKey === true,
        rowIndex,
        orderedRowIds: getOrderedRowIds(),
      });
    },
    [rowId, rowIndex, getOrderedRowIds, toggle],
  );

  return (
    <div
      className={`${classes.cell} ${classes.rowNumberCell} ${isPinned ? classes.cellPinned : ""}`}
      style={
        isPinned
          ? ({ "--pin-offset": `${pinOffset ?? 0}px` } as React.CSSProperties)
          : undefined
      }
    >
      <div className={classes.rowNumberCellInner}>
        {editable && (
          <span className={classes.rowNumberDragHandle} aria-label="Drag row">
            <IconGripVertical size={12} />
          </span>
        )}
        {editable && (
          <span className={classes.rowNumberCheckbox}>
            <Checkbox
              size="xs"
              checked={selected}
              onChange={handleCheckboxChange}
              aria-label="Select row"
            />
          </span>
        )}
        <span className={classes.rowNumberIndex}>{rowIndex + 1}</span>
      </div>
    </div>
  );
});
