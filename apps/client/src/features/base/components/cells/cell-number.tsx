import { useState, useRef, useEffect, useCallback } from "react";
import {
  IBaseProperty,
  NumberTypeOptions,
} from "@/features/base/types/base.types";
import cellClasses from "@/features/base/styles/cells.module.css";

type CellNumberProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

function formatNumber(
  val: number | null | undefined,
  options: NumberTypeOptions | undefined,
): string {
  if (val == null) return "";
  const precision = options?.precision ?? 0;
  const format = options?.format ?? "plain";

  switch (format) {
    case "currency":
      return `${options?.currencySymbol ?? "$"}${val.toFixed(precision)}`;
    case "percent":
      return `${val.toFixed(precision)}%`;
    case "progress":
      return `${Math.min(100, Math.max(0, val)).toFixed(0)}%`;
    default:
      return precision > 0 ? val.toFixed(precision) : String(val);
  }
}

export function CellNumber({
  value,
  property,
  isEditing,
  onCommit,
  onCancel,
}: CellNumberProps) {
  const numValue = typeof value === "number" ? value : null;
  const typeOptions = property.typeOptions as NumberTypeOptions | undefined;
  const [draft, setDraft] = useState(numValue != null ? String(numValue) : "");
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    if (isEditing) {
      committedRef.current = false;
      setDraft(numValue != null ? String(numValue) : "");
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isEditing, numValue]);

  const parseDraft = useCallback(() => {
    const parsed = draft === "" ? null : Number(draft);
    return parsed != null && isNaN(parsed) ? null : parsed;
  }, [draft]);

  const commitOnce = useCallback(
    (val: unknown) => {
      if (committedRef.current) return;
      committedRef.current = true;
      onCommit(val);
    },
    [onCommit],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitOnce(parseDraft());
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    },
    [parseDraft, commitOnce, onCancel],
  );

  const handleBlur = useCallback(() => {
    commitOnce(parseDraft());
  }, [parseDraft, commitOnce]);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        className={cellClasses.cellInput}
        style={{ textAlign: "right" }}
        value={draft}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "" || v === "-" || /^-?\d*\.?\d*$/.test(v)) {
            setDraft(v);
          }
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
    );
  }

  if (numValue == null) {
    return <span className={cellClasses.emptyValue} />;
  }

  return (
    <span className={cellClasses.numberValue}>
      {formatNumber(numValue, typeOptions)}
    </span>
  );
}
