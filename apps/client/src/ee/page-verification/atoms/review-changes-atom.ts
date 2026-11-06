import { atom } from "jotai";
import { ReviewChangesRequest } from "@/ee/page-verification/types/page-verification.types";

export const reviewChangesAtom = atom<ReviewChangesRequest | null>(
  null as ReviewChangesRequest | null,
);
