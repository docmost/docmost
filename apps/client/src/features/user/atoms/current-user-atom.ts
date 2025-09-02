import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { ICurrentUser, IUser } from "@/features/user/types/user.types";
import { IWorkspace } from "@/features/workspace/types/workspace.types";

export const currentUserAtom = atomWithStorage<ICurrentUser | null>(
  "currentUser",
  null,
);

export const userAtom = atom(
  (get) => {
    const currentUser = get(currentUserAtom);
    return currentUser?.user ?? null;
  },
  (get, set, newUser: IUser) => {
    const currentUser = get(currentUserAtom);
    if (currentUser) {
      set(currentUserAtom, {
        ...currentUser,
        user: newUser,
      });
    }
  }
);

export const workspaceAtom = atom(
  (get) => {
    const currentUser = get(currentUserAtom);
    return currentUser?.workspace ?? null;
  },
  (get, set, newWorkspace: IWorkspace) => {
    const currentUser = get(currentUserAtom);
    if (currentUser) {
      set(currentUserAtom, {
        ...currentUser,
        workspace: newWorkspace,
      });
    }
  }
);
