import { atomWithStorage } from "jotai/utils";

import { ICurrentUserResponse } from "@/features/user/types/user.types";

export const currentUserAtom = atomWithStorage<ICurrentUserResponse | null>("currentUser", null);
