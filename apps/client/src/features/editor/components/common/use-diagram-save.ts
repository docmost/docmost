import { useRef, useState } from "react";

type SaveTask = () => Promise<void>;

// Runs a diagram's saves one at a time. A requested save waits its turn, an autosave is skipped while one is underway.
export function useDiagramSave() {
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const lastRef = useRef<Promise<void>>(Promise.resolve());
  const requestedRef = useRef<Promise<void> | null>(null);

  const enqueue = (task: SaveTask) => {
    isSavingRef.current = true;
    setIsSaving(true);

    const run: Promise<void> = lastRef.current
      .catch(() => undefined)
      .then(task)
      .finally(() => {
        // another save is waiting behind this one
        if (lastRef.current !== run) return;
        isSavingRef.current = false;
        setIsSaving(false);
      });
    lastRef.current = run;
    return run;
  };

  const save = (task: SaveTask) => {
    // asked for again before it is done, it is the same save
    requestedRef.current ??= enqueue(task).finally(() => {
      requestedRef.current = null;
    });
    return requestedRef.current;
  };

  const autosave = (task: SaveTask) =>
    isSavingRef.current ? Promise.resolve() : enqueue(task);

  return { isSaving, isSavingRef, save, autosave };
}
