import { memo, useCallback, useMemo } from "react";
import { Checkbox } from "@mantine/core";
import { IconGripVertical } from "@tabler/icons-react";
import { useAtomValue, useSetAtom, type PrimitiveAtom } from "jotai";
import { selectAtom } from "jotai/utils";
import { useRowSelection } from "@/ee/base/hooks/use-row-selection";
import { focusedCellAtomFamily } from "@/ee/base/atoms/base-atoms";
import { FocusedCell } from "@/ee/base/types/base.types";
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

  const setFocusedCell = useSetAtom(
    focusedCellAtomFamily(pageId) as PrimitiveAtom<FocusedCell>,
  );
  const isFocused = useAtomValue(
    useMemo(
      () =>
        selectAtom(
          focusedCellAtomFamily(pageId),
          (fc) => fc?.rowId === rowId && fc?.propertyId === "__row_number",
        ),
      [pageId, rowId],
    ),
  );

  const handleCellMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      setFocusedCell({ rowId, propertyId: "__row_number" });
    },
    [rowId, setFocusedCell],
  );

  const handleCellClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      setFocusedCell({ rowId, propertyId: "__row_number" });
      (e.currentTarget.closest('[role="grid"]') as HTMLElement | null)?.focus({
        preventScroll: true,
      });
    },
    [rowId, setFocusedCell],
  );

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
      id={`base-cell-${rowId}-__row_number`}
      role="gridcell"
      className={`${classes.cell} ${classes.rowNumberCell} ${isPinned ? classes.cellPinned : ""} ${isFocused ? classes.cellFocused : ""}`}
      style={
        isPinned
          ? ({ "--pin-offset": `${pinOffset ?? 0}px` } as React.CSSProperties)
          : undefined
      }
      onClick={handleCellClick}
      onMouseDown={handleCellMouseDown}
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
              tabIndex={-1}
            />
          </span>
        )}
        <span className={classes.rowNumberIndex}>{rowIndex + 1}</span>
      </div>
    </div>
  );
});
