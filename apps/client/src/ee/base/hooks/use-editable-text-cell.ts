import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useStore, type PrimitiveAtom } from "jotai";
import { pendingTypeInsertAtom, type PendingTypeInsert } from "@/ee/base/atoms/base-atoms";

export type UseEditableTextCellParams = {
  value: unknown;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
  /** value -> the draft string shown in the input when editing begins */
  toDraft: (value: unknown) => string;
  /** draft string -> the value passed to onCommit */
  parse: (draft: string) => unknown;
  rowId?: string;
  propertyId?: string;
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
  rowId,
  propertyId,
}: UseEditableTextCellParams): EditableTextCell {
  const [draft, setDraft] = useState(() => toDraft(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);
  const wasEditingRef = useRef(false);
  const toDraftRef = useRef(toDraft);
  toDraftRef.current = toDraft;
  const store = useStore();

  useLayoutEffect(() => {
    if (isEditing && !wasEditingRef.current) {
      committedRef.current = false;
      const pending = store.get(pendingTypeInsertAtom);
      const seeded =
        pending != null &&
        pending.rowId === rowId &&
        pending.propertyId === propertyId;
      const nextDraft = seeded ? pending.char : toDraftRef.current(value);
      if (seeded) {
        store.set(pendingTypeInsertAtom as PrimitiveAtom<PendingTypeInsert>, null);
      }
      setDraft(nextDraft);
      const el = inputRef.current;
      if (el) {
        el.value = nextDraft;
        el.focus({ preventScroll: true });
        try {
          el.setSelectionRange(nextDraft.length, nextDraft.length);
        } catch {
          // email/number inputs reject setSelectionRange
        }
        el.scrollLeft = el.scrollWidth;
      }
    }
    wasEditingRef.current = isEditing;
  }, [isEditing, value, rowId, propertyId, store]);

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
