import { useEffect, useRef, useState } from "react";
import { NumberTypeOptions } from "@/ee/base/types/base.types";
import { formatNumber } from "@/ee/base/components/cells/cell-number";
import { FieldProps, FieldShell } from "./detail-field";
import classes from "@/ee/base/styles/row-detail-modal.module.css";

const toDraft = (value: unknown) =>
  typeof value === "number" ? String(value) : "";

const parse = (draft: string) => {
  const parsed = draft === "" ? null : Number(draft);
  return parsed != null && isNaN(parsed) ? null : parsed;
};

export function FieldNumber({ property, value, readOnly, onChange }: FieldProps) {
  const typeOptions = property.typeOptions as NumberTypeOptions | undefined;
  const numValue = typeof value === "number" ? value : null;
  const [draft, setDraft] = useState(toDraft(value));
  const [focused, setFocused] = useState(false);
  // Esc sets this; blur() then runs commit synchronously with the stale
  // draft, so the revert must be decided here, not via setDraft.
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!focused) setDraft(toDraft(value));
  }, [value, focused]);

  const formatted = formatNumber(numValue, typeOptions);

  if (readOnly) {
    return (
      <FieldShell>
        <span className={classes.fieldValueText}>{formatted}</span>
      </FieldShell>
    );
  }

  const commit = () => {
    setFocused(false);
    if (cancelRef.current) {
      cancelRef.current = false;
      setDraft(toDraft(value));
      return;
    }
    if (parse(draft) !== numValue) onChange(parse(draft));
  };

  return (
    <FieldShell cursor="text">
      <input
        type="text"
        inputMode="decimal"
        className={classes.fieldInput}
        value={focused ? draft : formatted}
        onFocus={() => {
          setDraft(toDraft(value));
          setFocused(true);
        }}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "" || v === "-" || /^-?\d*\.?\d*$/.test(v)) {
            setDraft(v);
          }
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            cancelRef.current = true;
            e.currentTarget.blur();
          }
        }}
        aria-label={property.name}
      />
    </FieldShell>
  );
}
