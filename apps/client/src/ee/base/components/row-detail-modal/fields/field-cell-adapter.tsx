import { useCallback, useRef, useState } from "react";
import { getDescriptor } from "@/ee/base/property-types/property-type.registry";
import { FieldProps, FieldShell } from "./detail-field";
import classes from "@/ee/base/styles/row-detail-modal.module.css";

/** Person, file and page editors are popover pickers owned by their cell
 *  components; the shell supplies modal styling and click-anywhere
 *  activation while the cell keeps its picker behavior. */
export function FieldCellAdapter({
  property,
  value,
  rowId,
  readOnly,
  onChange,
}: FieldProps) {
  const [editing, setEditing] = useState(false);
  // Whether the picker was open when the current gesture's mousedown fired.
  const editingAtMouseDownRef = useRef(false);
  const CellComponent = getDescriptor(property.type)?.cellComponent;

  // Files stay openable read-only (download-only popover), matching the grid.
  const canActivate = !readOnly || property.type === "file";

  // Activate on click, not mousedown: opening on mousedown mounts the cell's
  // picker mid-dispatch, and its document-level outside-mousedown listener
  // then catches the same still-bubbling event and instantly closes it. By
  // click time the mousedown has fully finished. The ref keeps toggle-close
  // working: when the gesture started with the picker open, the picker's own
  // outside-close already handled it and we must not reopen.
  const handleMouseDown = useCallback(() => {
    editingAtMouseDownRef.current = editing;
  }, [editing]);

  const handleClick = useCallback(() => {
    if (!canActivate || editingAtMouseDownRef.current || editing) return;
    setEditing(true);
  }, [canActivate, editing]);

  const handleCommit = useCallback(
    (next: unknown) => {
      setEditing(false);
      onChange(next);
    },
    [onChange],
  );
  const handleCancel = useCallback(() => setEditing(false), []);

  if (!CellComponent) return <FieldShell />;

  return (
    <FieldShell
      cursor={canActivate ? "pointer" : "default"}
      active={editing}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      role={canActivate ? "button" : undefined}
      tabIndex={canActivate ? 0 : undefined}
      aria-label={property.name}
      onKeyDown={(e) => {
        if (canActivate && !editing && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          setEditing(true);
        }
      }}
    >
      <div className={classes.fieldCellDisplay}>
        <CellComponent
          value={value}
          property={property}
          rowId={rowId}
          isEditing={editing}
          readOnly={readOnly}
          onCommit={handleCommit}
          onValueChange={onChange}
          onCancel={handleCancel}
        />
      </div>
    </FieldShell>
  );
}
