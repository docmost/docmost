import { atom } from "jotai";
import { IReviewChangesRequest } from "@/ee/page-verification/types/page-verification.types";

export const reviewChangesAtom = atom<IReviewChangesRequest | null>(
  null as IReviewChangesRequest | null,
);
