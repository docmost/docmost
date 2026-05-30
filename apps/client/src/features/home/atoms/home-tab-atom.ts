import { atomWithStorage } from "jotai/utils";

export const homeTabAtom = atomWithStorage<string>("home-tab", "recent");
