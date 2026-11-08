import { atom } from "jotai";
import { CoverFocusRequest } from "@/features/page-cover/page-cover.types.ts";

export const coverFocusRequestAtom = atom(null as CoverFocusRequest | null);
