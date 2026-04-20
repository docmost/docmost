import { useCallback, useMemo } from "react";
import { useAtom } from "jotai";
import { RESET } from "jotai/utils";
import {
  BaseViewDraft,
  FilterGroup,
  ViewConfig,
  ViewSortConfig,
} from "@/features/base/types/base.types";
import { viewDraftAtomFamily } from "@/features/base/atoms/view-draft-atom";

export type UseViewDraftArgs = {
  userId: string | undefined;
  baseId: string | undefined;
  viewId: string | undefined;
  baselineFilter: FilterGroup | undefined;
  baselineSorts: ViewSortConfig[] | undefined;
};

export type ViewDraftState = {
  draft: BaseViewDraft | null;
  effectiveFilter: FilterGroup | undefined;
  effectiveSorts: ViewSortConfig[] | undefined;
  isDirty: boolean;
  setFilter: (filter: FilterGroup | undefined) => void;
  setSorts: (sorts: ViewSortConfig[] | undefined) => void;
  reset: () => void;
  buildPromotedConfig: (baseline: ViewConfig) => ViewConfig;
};

// JSON-stringify equality is good enough for FilterGroup (pure data tree)
// and ViewSortConfig[] — V8 preserves non-numeric key insertion order so
// the same object graph serializes identically. Avoids pulling in
// lodash/fast-deep-equal for two known-shaped types. (Spec "Dirty check".)
function filterEq(a: FilterGroup | undefined, b: FilterGroup | undefined) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
function sortsEq(
  a: ViewSortConfig[] | undefined,
  b: ViewSortConfig[] | undefined,
) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function useViewDraft(args: UseViewDraftArgs): ViewDraftState {
  const { userId, baseId, viewId, baselineFilter, baselineSorts } = args;
  const ready = !!(userId && baseId && viewId);

  // Always mount an atom with a stable shape so hook order is consistent.
  // When not ready we still feed a key, but we won't read/write it.
  const atomKey = useMemo(
    () => ({
      userId: userId ?? "",
      baseId: baseId ?? "",
      viewId: viewId ?? "",
    }),
    [userId, baseId, viewId],
  );
  const [storedDraft, setDraft] = useAtom(viewDraftAtomFamily(atomKey));

  const draft = ready ? storedDraft : null;

  const setFilter = useCallback(
    (next: FilterGroup | undefined) => {
      if (!ready) return;
      const current = storedDraft ?? null;
      const mergedFilter = next;
      const mergedSorts = current?.sorts;
      if (mergedFilter === undefined && (mergedSorts === undefined || mergedSorts === null)) {
        setDraft(RESET);
        return;
      }
      setDraft({
        filter: mergedFilter,
        sorts: mergedSorts,
        updatedAt: new Date().toISOString(),
      });
    },
    [ready, storedDraft, setDraft],
  );

  const setSorts = useCallback(
    (next: ViewSortConfig[] | undefined) => {
      if (!ready) return;
      const current = storedDraft ?? null;
      const mergedFilter = current?.filter;
      const mergedSorts = next;
      if (mergedFilter === undefined && (mergedSorts === undefined || mergedSorts === null)) {
        setDraft(RESET);
        return;
      }
      setDraft({
        filter: mergedFilter,
        sorts: mergedSorts,
        updatedAt: new Date().toISOString(),
      });
    },
    [ready, storedDraft, setDraft],
  );

  const reset = useCallback(() => {
    if (!ready) return;
    setDraft(RESET);
  }, [ready, setDraft]);

  const effectiveFilter = useMemo(
    () => (draft?.filter !== undefined ? draft.filter : baselineFilter),
    [draft?.filter, baselineFilter],
  );
  const effectiveSorts = useMemo(
    () => (draft?.sorts !== undefined ? draft.sorts : baselineSorts),
    [draft?.sorts, baselineSorts],
  );

  const isDirty = useMemo(() => {
    if (!draft) return false;
    const filterDirty =
      draft.filter !== undefined && !filterEq(draft.filter, baselineFilter);
    const sortsDirty =
      draft.sorts !== undefined && !sortsEq(draft.sorts, baselineSorts);
    return filterDirty || sortsDirty;
  }, [draft, baselineFilter, baselineSorts]);

  const buildPromotedConfig = useCallback(
    (baseline: ViewConfig): ViewConfig => ({
      ...baseline,
      filter: draft?.filter ?? baseline.filter,
      sorts: draft?.sorts ?? baseline.sorts,
    }),
    [draft],
  );

  if (!ready) {
    return {
      draft: null,
      effectiveFilter: baselineFilter,
      effectiveSorts: baselineSorts,
      isDirty: false,
      setFilter: () => {},
      setSorts: () => {},
      reset: () => {},
      buildPromotedConfig: (baseline) => baseline,
    };
  }

  return {
    draft,
    effectiveFilter,
    effectiveSorts,
    isDirty,
    setFilter,
    setSorts,
    reset,
    buildPromotedConfig,
  };
}
