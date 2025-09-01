import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { ICurrentUser } from "@/features/user/types/user.types";

export const currentUserAtom = atomWithStorage<ICurrentUser | null>(
  "currentUser",
  null,
);

export const userAtom = atom((get) => {
  const currentUser = get(currentUserAtom);
  return currentUser?.user ?? null;
});

export const workspaceAtom = atom((get) => {
  const currentUser = get(currentUserAtom);
  return currentUser?.workspace ?? null;
});
