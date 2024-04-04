import { atomWithStorage } from "jotai/utils";

import { ICurrentUser } from "@/features/user/types/user.types";

export const currentUserAtom = atomWithStorage<ICurrentUser | null>("currentUser", null);
