import { useState, useRef, useEffect, useCallback } from "react";
import { IBaseProperty } from "@/features/base/types/base.types";
import cellClasses from "@/features/base/styles/cells.module.css";

type CellEmailProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

export function CellEmail({
  value,
  isEditing,
  onCommit,
  onCancel,
}: CellEmailProps) {
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
        commitOnce(draft || null);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    },
    [draft, commitOnce, onCancel],
  );

  const handleBlur = useCallback(() => {
    commitOnce(draft || null);
  }, [draft, commitOnce]);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="email"
        className={cellClasses.cellInput}
        value={draft}
        placeholder="email@example.com"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
    );
  }

  if (!displayValue) {
    return <span className={cellClasses.emptyValue} />;
  }

  return (
    <a
      className={cellClasses.emailLink}
      href={`mailto:${displayValue}`}
      onClick={(e) => e.stopPropagation()}
    >
      {displayValue}
    </a>
  );
}
