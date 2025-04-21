import { atomWithStorage } from "jotai/utils";

import { ICurrentUser } from "@/features/user/types/user.types";
import { focusAtom } from "jotai-optics";

export const currentUserAtom = atomWithStorage<ICurrentUser | null>(
  "currentUser",
  null,
);

export const userAtom = focusAtom(currentUserAtom, (optic) =>
  optic.prop("user"),
);
export const workspaceAtom = focusAtom(currentUserAtom, (optic) =>
  optic.prop("workspace"),
);
