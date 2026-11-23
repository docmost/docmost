import { atom } from "jotai";
import { atomWithDefault } from "jotai/utils";
import type { Editor } from "@tiptap/core";
import { userAtom } from "@/features/user/atoms/current-user-atom";
import { PageEditMode } from "@/features/user/types/user.types.ts";

type PageEditorBinding = {
  pageId: string;
  editor: Editor;
  editable: boolean;
};

export const pageEditorBindingAtom = atom(null as PageEditorBinding | null);

export const pageEditorAtom = atom(
  (get) => get(pageEditorBindingAtom)?.editor ?? null,
);

export const titleEditorAtom = atom<Editor | null>(null);

export const readOnlyEditorAtom = atom<Editor | null>(null);

export const yjsConnectionStatusAtom = atom<string>("");

export const yjsSyncedAtom = atom<boolean>(false);

export const showAiMenuAtom = atom(false);

export const showLinkMenuAtom = atom(false);

export type LightboxRequest = {
  src: string;
  type: "image" | "video";
} | null;

const initialLightboxRequest: LightboxRequest = null;
export const lightboxRequestAtom = atom(initialLightboxRequest);

// Current page's edit mode — initialized from the user's saved preference on
// first load, can be toggled locally without persisting to the server.
export const currentPageEditModeAtom = atomWithDefault<PageEditMode>((get) =>
  get(userAtom)?.settings?.preferences?.pageEditMode === PageEditMode.Read
    ? PageEditMode.Read
    : PageEditMode.Edit,
);
