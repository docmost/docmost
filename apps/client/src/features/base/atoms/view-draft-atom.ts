import { atomFamily, atomWithStorage } from "jotai/utils";
import { BaseViewDraft } from "@/features/base/types/base.types";

export type ViewDraftKey = {
  userId: string;
  baseId: string;
  viewId: string;
};

export const viewDraftStorageKey = (k: ViewDraftKey) =>
  `docmost:base-view-draft:v1:${k.userId}:${k.baseId}:${k.viewId}`;

// `atomWithStorage` handles JSON serialization, cross-tab sync via the
// `storage` event, and lazy first-read out of the box. `atomFamily`'s
// comparator ensures the same triple resolves to the same atom instance
// across renders, so identity-equality cache hits in Jotai still work.
export const viewDraftAtomFamily = atomFamily(
  (k: ViewDraftKey) =>
    atomWithStorage<BaseViewDraft | null>(viewDraftStorageKey(k), null),
  (a, b) =>
    a.userId === b.userId && a.baseId === b.baseId && a.viewId === b.viewId,
);
