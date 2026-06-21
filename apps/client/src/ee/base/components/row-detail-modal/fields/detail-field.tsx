import { forwardRef } from "react";
import { Checkbox } from "@mantine/core";
import { IconLock } from "@tabler/icons-react";
import clsx from "clsx";
import { IBaseProperty, IBaseRow } from "@/ee/base/types/base.types";
import { getDescriptor } from "@/ee/base/property-types/property-type.registry";
import { FieldText } from "./field-text";
import { FieldLongText } from "./field-long-text";
import { FieldNumber } from "./field-number";
import { FieldDate } from "./field-date";
import { FieldChoice } from "./field-choice";
import { FieldCellAdapter } from "./field-cell-adapter";
import classes from "@/ee/base/styles/row-detail-modal.module.css";

export type FieldProps = {
  property: IBaseProperty;
  value: unknown;
  rowId: string;
  readOnly: boolean;
  onChange: (value: unknown) => void;
};

type FieldShellProps = {
  /** Visual + cursor treatment: text caret, pointer (opens a picker), or none. */
  cursor?: "text" | "pointer" | "default";
  /** Popover open — keeps the focus ring while focus is in the portal. */
  active?: boolean;
  locked?: boolean;
  alignTop?: boolean;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

// forwardRef is load-bearing: Popover.Target anchors its dropdown through a
// ref injected into this element; without it the picker renders at (0,0).
export const FieldShell = forwardRef<HTMLDivElement, FieldShellProps>(
  function FieldShell(
    { cursor = "default", active, locked, alignTop, className, children, ...rest },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={clsx(
          classes.fieldShell,
          cursor === "text" && classes.fieldShellText,
          cursor === "pointer" && classes.fieldShellPointer,
          active && classes.fieldShellActive,
          locked && classes.fieldShellLocked,
          alignTop && classes.fieldShellTop,
          className,
        )}
        {...rest}
      >
        {locked && <IconLock size={13} className={classes.fieldLockIcon} />}
        {children}
      </div>
    );
  },
);

function FieldCheckbox({ value, readOnly, onChange }: FieldProps) {
  const checked = value === true;
  return (
    <FieldShell>
      <Checkbox
        size="sm"
        checked={checked}
        disabled={readOnly}
        onChange={() => onChange(!checked)}
      />
    </FieldShell>
  );
}

function FieldReadonlyCell({ property, value, rowId }: FieldProps) {
  const CellComponent = getDescriptor(property.type)?.cellComponent;
  return (
    <FieldShell locked>
      <div className={classes.fieldCellDisplay}>
        {CellComponent && (
          <CellComponent
            value={value}
            property={property}
            rowId={rowId}
            isEditing={false}
            readOnly
            onCommit={() => {}}
            onValueChange={() => {}}
            onCancel={() => {}}
          />
        )}
      </div>
    </FieldShell>
  );
}

type DetailFieldProps = {
  property: IBaseProperty;
  row: IBaseRow;
  readOnly: boolean;
  onUpdate: (propertyId: string, value: unknown) => void;
};

export function DetailField({ property, row, readOnly, onUpdate }: DetailFieldProps) {
  const descriptor = getDescriptor(property.type);
  const value = descriptor?.systemAccessor
    ? descriptor.systemAccessor(row)
    : (row.cells ?? {})[property.id];
  const fieldProps: FieldProps = {
    property,
    value,
    rowId: row.id,
    readOnly,
    onChange: (next: unknown) => onUpdate(property.id, next),
  };

  switch (property.type) {
    case "text":
    case "url":
    case "email":
      return <FieldText {...fieldProps} />;
    case "longText":
      return <FieldLongText {...fieldProps} />;
    case "number":
      return <FieldNumber {...fieldProps} />;
    case "checkbox":
      return <FieldCheckbox {...fieldProps} />;
    case "date":
      return <FieldDate {...fieldProps} />;
    case "select":
    case "status":
    case "multiSelect":
      return <FieldChoice {...fieldProps} />;
    case "person":
    case "file":
    case "page":
      return <FieldCellAdapter {...fieldProps} />;
    default:
      // createdAt, lastEditedAt, lastEditedBy, formula and future types.
      return <FieldReadonlyCell {...fieldProps} />;
  }
}
