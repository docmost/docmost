import { atomFamily, atomWithStorage } from "jotai/utils";
import { BaseViewDraft } from "@/ee/base/types/base.types";

export type ViewDraftKey = {
  userId: string;
  pageId: string;
  viewId: string;
};

export const viewDraftStorageKey = (k: ViewDraftKey) =>
  `docmost:base-view-draft:v1:${k.userId}:${k.pageId}:${k.viewId}`;

// atomWithStorage handles JSON serialization and cross-tab sync. The custom
// comparator ensures the same userId/pageId/viewId triple resolves to the
// same atom instance, so Jotai's identity-equality cache hits still work.
export const viewDraftAtomFamily = atomFamily(
  (k: ViewDraftKey) =>
    atomWithStorage<BaseViewDraft | null>(viewDraftStorageKey(k), null),
  (a, b) =>
    a.userId === b.userId && a.pageId === b.pageId && a.viewId === b.viewId,
);
