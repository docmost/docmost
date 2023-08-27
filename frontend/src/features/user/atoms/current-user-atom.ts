import { atom } from "jotai";
import { ICurrentUserResponse } from "@/features/user/types/user.types";

export const currentUserAtom = atom<ICurrentUserResponse | null>(null);
