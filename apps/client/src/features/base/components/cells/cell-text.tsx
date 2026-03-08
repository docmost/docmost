import { useState, useRef, useEffect, useCallback } from "react";
import { IBaseProperty } from "@/features/base/types/base.types";
import cellClasses from "@/features/base/styles/cells.module.css";
import gridClasses from "@/features/base/styles/grid.module.css";

type CellTextProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

export function CellText({
  value,
  isEditing,
  onCommit,
  onCancel,
}: CellTextProps) {
  const displayValue = typeof value === "string" ? value : "";
  const [draft, setDraft] = useState(displayValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    if (isEditing) {
      committedRef.current = false;
      setDraft(displayValue);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isEditing, displayValue]);

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
        commitOnce(draft);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    },
    [draft, commitOnce, onCancel],
  );

  const handleBlur = useCallback(() => {
    commitOnce(draft);
  }, [draft, commitOnce]);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        className={cellClasses.cellInput}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
    );
  }

  if (!displayValue) {
    return <span className={cellClasses.emptyValue} />;
  }

  return <span className={gridClasses.cellContent}>{displayValue}</span>;
}
