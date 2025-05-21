import { atom, WritableAtom } from "jotai";

export const settingsOriginAtom: WritableAtom<string | null, [string | null], void> = atom(
  null,
  (get, set, newValue) => {
    if (get(settingsOriginAtom) !== newValue) {
      set(settingsOriginAtom, newValue);
    }
  }
);
