import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const EMPTY_OPTIONS: Record<string, unknown> = {};

function optionsEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const av = a[key];
    const bv = b[key];
    if (Array.isArray(av) && Array.isArray(bv)) {
      if (av.length !== bv.length || av.some((v, i) => v !== bv[i])) {
        return false;
      }
    } else if (av !== bv) {
      return false;
    }
  }
  return true;
}

// Draft hook for non-choice option editors: live in create flow, staged in edit menu.
export function useEditableTypeOptions(
  initialRaw: Record<string, unknown> | undefined,
  {
    onUpdate,
    onClose,
    onDirtyChange,
    hideButtons,
  }: {
    onUpdate: (opts: Record<string, unknown>) => void;
    onClose: () => void;
    onDirtyChange?: (dirty: boolean) => void;
    hideButtons?: boolean;
  },
) {
  const initial = initialRaw ?? EMPTY_OPTIONS;
  const [draft, setDraft] = useState<Record<string, unknown>>(initial);

  useEffect(() => {
    if (!hideButtons) setDraft(initial);
  }, [initial, hideButtons]);

  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  useEffect(() => {
    if (hideButtons) onUpdateRef.current(draft);
  }, [hideButtons, draft]);

  const isDirty = useMemo(() => !optionsEqual(draft, initial), [draft, initial]);
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const update = useCallback(
    (patch: Record<string, unknown>) =>
      setDraft((prev) => ({ ...prev, ...patch })),
    [],
  );
  const save = useCallback(() => {
    onUpdate(draft);
    onClose();
  }, [draft, onUpdate, onClose]);
  const cancel = useCallback(() => {
    setDraft(initial);
    onDirtyChange?.(false);
    onClose();
  }, [initial, onClose, onDirtyChange]);

  return { draft, update, isDirty, save, cancel };
}
