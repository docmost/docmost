import { atomWithStorage } from "jotai/utils";
import type { Entitlements } from "./entitlement.types";

export const entitlementAtom = atomWithStorage<Entitlements | null>(
  "entitlements",
  null,
);
