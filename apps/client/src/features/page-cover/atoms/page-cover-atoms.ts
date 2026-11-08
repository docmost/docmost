import { atom } from "jotai";
import { CoverFocusRequest } from "@/features/page-cover/page-cover.types.ts";

// where focus should land after the focused cover control disappears
export const coverFocusRequestAtom = atom(null as CoverFocusRequest | null);
