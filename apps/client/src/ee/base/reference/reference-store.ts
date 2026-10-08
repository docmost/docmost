import { useCallback, useEffect, useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { referenceStoreAtomFamily, mergeReferences } from "@/ee/base/atoms/reference-store-atom";
import { useResolvedPages, type ResolvedPage } from "@/ee/base/queries/base-page-resolver-query";
import type { RowReferences, UserRef } from "@/ee/base/types/base.types";
import useCurrentUser from "@/features/user/hooks/use-current-user";

export function useHydrateReferences(
  pageId: string | undefined,
  pages: RowReferences[],
): void {
  const setStore = useSetAtom(referenceStoreAtomFamily(pageId ?? ""));
  const flat = useMemo(() => pages, [pages]);
  useEffect(() => {
    if (!pageId || flat.length === 0) return;
    setStore((prev) => flat.reduce((acc, r) => mergeReferences(acc, r), prev));
  }, [pageId, flat, setStore]);
}

export function useReferenceStore(pageId: string): RowReferences {
  return useAtomValue(referenceStoreAtomFamily(pageId));
}

// Imperatively merges resolved users on pick so a just-selected person resolves without a rows-page refetch.
export function useHydrateUsers(pageId: string): (users: UserRef[]) => void {
  const setStore = useSetAtom(referenceStoreAtomFamily(pageId));
  return useCallback(
    (users: UserRef[]) => {
      if (users.length === 0) return;
      const map: Record<string, UserRef> = {};
      for (const u of users) map[u.id] = u;
      setStore((prev) => mergeReferences(prev, { users: map, pages: {} }));
    },
    [setStore],
  );
}

// Hydrates the signed-in user so lastEditedBy cells resolve without a refetch.
export function useHydrateCurrentUser(pageId: string): void {
  const { data: currentUser } = useCurrentUser();
  const hydrateUsers = useHydrateUsers(pageId);
  const u = currentUser?.user;
  useEffect(() => {
    if (!u) return;
    hydrateUsers([{ id: u.id, name: u.name ?? null, avatarUrl: u.avatarUrl ?? null }]);
  }, [u?.id, u?.name, u?.avatarUrl, hydrateUsers]);
}

// Store-first lookup; falls back to the batched /bases/pages/expand on a miss.
export function useResolvePage(
  pageId: string,
  id: string | null,
): ResolvedPage | null | undefined {
  const store = useReferenceStore(pageId);
  const stored = id ? store.pages[id] : undefined;
  const { pages } = useResolvedPages(stored || !id ? [] : [id]);
  if (!id) return undefined;
  if (stored) return stored;
  return pages.get(id);
}
