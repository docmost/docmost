import { atom } from "jotai";
import type { MicrosoftFileItem } from "@docmost/editor-ext";

export const microsoftFullscreenAtom = atom<MicrosoftFileItem | null>(null);
export const microsoftPreviewDialogAtom = atom<MicrosoftFileItem | null>(null);
export const microsoftFullscreenHostsAtom = atom(0);

const pendingPickerKeys = new Set<string>();

export function requestMicrosoftPicker(key: string) {
  pendingPickerKeys.add(key);
}

export function consumeMicrosoftPickerRequest(key: string | null | undefined): boolean {
  if (!key || !pendingPickerKeys.has(key)) return false;
  pendingPickerKeys.delete(key);
  return true;
}
