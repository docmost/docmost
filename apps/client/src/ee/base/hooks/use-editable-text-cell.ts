import { useCallback, useEffect, useRef, useState } from "react";

export type UseEditableTextCellParams = {
  value: unknown;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
  /** value -> the draft string shown in the input when editing begins */
  toDraft: (value: unknown) => string;
  /** draft string -> the value passed to onCommit */
  parse: (draft: string) => unknown;
};

export type EditableTextCell = {
  draft: string;
  setDraft: (draft: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleBlur: () => void;
};

export function useEditableTextCell({
  value,
  isEditing,
  onCommit,
  onCancel,
  toDraft,
  parse,
}: UseEditableTextCellParams): EditableTextCell {
  const [draft, setDraft] = useState(() => toDraft(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);
  const wasEditingRef = useRef(false);
  const toDraftRef = useRef(toDraft);
  toDraftRef.current = toDraft;

  useEffect(() => {
    if (isEditing && !wasEditingRef.current) {
      committedRef.current = false;
      setDraft(toDraftRef.current(value));
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
    wasEditingRef.current = isEditing;
  }, [isEditing, value]);

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
        commitOnce(parse(draft));
      } else if (e.key === "Escape") {
        e.preventDefault();
        committedRef.current = true;
        onCancel();
      }
    },
    [draft, parse, commitOnce, onCancel],
  );

  const handleBlur = useCallback(() => {
    commitOnce(parse(draft));
  }, [draft, parse, commitOnce]);

  return { draft, setDraft, inputRef, handleKeyDown, handleBlur };
}
