import { memo, useCallback } from "react";
import { Checkbox } from "@mantine/core";
import { IconGripVertical } from "@tabler/icons-react";
import { useRowSelection } from "@/features/base/hooks/use-row-selection";
import classes from "@/features/base/styles/grid.module.css";

type RowDragProps = {
  draggable: boolean;
  onDragStart: (e: React.DragEvent) => void;
};

type RowNumberCellProps = {
  rowId: string;
  rowIndex: number;
  orderedRowIds: string[];
  isPinned: boolean;
  pinOffset?: number;
  rowDragProps?: RowDragProps;
};

export const RowNumberCell = memo(function RowNumberCell({
  rowId,
  rowIndex,
  orderedRowIds,
  isPinned,
  pinOffset,
  rowDragProps,
}: RowNumberCellProps) {
  const { isSelected, toggle } = useRowSelection();
  const selected = isSelected(rowId);

  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const nativeEvent = e.nativeEvent as MouseEvent;
      toggle(rowId, {
        shiftKey: nativeEvent.shiftKey === true,
        rowIndex,
        orderedRowIds,
      });
    },
    [rowId, rowIndex, orderedRowIds, toggle],
  );

  return (
    <div
      className={`${classes.cell} ${classes.rowNumberCell} ${isPinned ? classes.cellPinned : ""}`}
      style={isPinned ? { left: pinOffset } : undefined}
    >
      <div className={classes.rowNumberCellInner}>
        <span
          className={classes.rowNumberDragHandle}
          draggable={rowDragProps?.draggable}
          onDragStart={rowDragProps?.onDragStart}
          aria-label="Drag row"
        >
          <IconGripVertical size={12} />
        </span>
        <span className={classes.rowNumberCheckbox}>
          <Checkbox
            size="xs"
            checked={selected}
            onChange={handleCheckboxChange}
            aria-label="Select row"
          />
        </span>
        <span className={classes.rowNumberIndex}>{rowIndex + 1}</span>
      </div>
    </div>
  );
});
