import { useState, useCallback, useMemo } from "react";
import clsx from "clsx";
import { IconLock } from "@tabler/icons-react";
import { BasePropertyType, IBaseProperty, IBaseRow } from "@/features/base/types/base.types";
import { CellRenderer } from "@/features/base/components/cells/cell-renderer";
import { propertyTypes } from "@/features/base/components/property/property-type-picker";
import classes from "./row-detail-modal.module.css";

type PropertyRowProps = {
  property: IBaseProperty;
  row: IBaseRow;
  canEdit: boolean;
  onUpdate: (propertyId: string, value: unknown) => void;
};

// Cell types that are derived/read-only — clicking shouldn't switch them
// into edit mode and the row gets a tiny lock glyph in front of the value.
const READONLY_TYPES = new Set<BasePropertyType>([
  "formula",
  "createdAt",
  "lastEditedAt",
  "lastEditedBy",
]);

const ICON_BY_TYPE = new Map(propertyTypes.map((p) => [p.type, p.icon] as const));

export function PropertyRow({ property, row, canEdit, onUpdate }: PropertyRowProps) {
  const value = (row.cells ?? {})[property.id];
  const [editing, setEditing] = useState(false);

  const isReadonlyType = READONLY_TYPES.has(property.type);
  const interactive = canEdit && !isReadonlyType;

  const handleCommit = useCallback(
    (next: unknown) => {
      setEditing(false);
      onUpdate(property.id, next);
    },
    [onUpdate, property.id],
  );
  const handleCancel = useCallback(() => setEditing(false), []);

  // Activate on `mousedown`, not `click`. Mantine's `useClickOutside`
  // (the one wired up by every child `Popover`) also fires on mousedown,
  // and React batches setState calls within the same DOM event. By
  // riding the same event we get:
  //   1. mousedown on a wrapper whose child Popover is open →
  //      useClickOutside calls setEditing(false), our handler reads the
  //      same render's `editing === true` so it bails on `!editing` and
  //      doesn't queue setEditing(true). React flushes → popover closes.
  //   2. mousedown on a non-editing wrapper → `!editing` is true →
  //      setEditing(true) → popover opens.
  // Using `onClick` would split steps 1a/1b across two DOM events; React
  // would re-render between them with the popover closed, my click
  // closure would then see `editing === false`, and the popover would
  // re-open on the same gesture that was meant to dismiss it.
  const handleActivate = useCallback(() => {
    if (interactive && !editing) setEditing(true);
  }, [interactive, editing]);

  const Icon = useMemo(() => ICON_BY_TYPE.get(property.type), [property.type]);

  return (
    <div className={classes.propertyRow}>
      <div className={classes.propertyLabel}>
        {Icon && <Icon size={15} className={classes.propertyLabelIcon} />}
        <span className={classes.propertyLabelText}>{property.name}</span>
      </div>
      <div
        className={clsx(classes.propertyValueWrap, {
          [classes.editing]: editing,
          [classes.locked]: isReadonlyType,
          [classes.readOnlyCell]: !canEdit,
        })}
        onMouseDown={handleActivate}
      >
        {isReadonlyType && (
          <IconLock size={13} className={classes.lockIcon} />
        )}
        <div className={classes.valueInner}>
          <CellRenderer
            property={property}
            rowId={row.id}
            value={value}
            isEditing={editing}
            onCommit={handleCommit}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </div>
  );
}
