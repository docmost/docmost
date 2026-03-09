import { atom } from "jotai";
import type { Entitlements } from "./entitlement.types";

const initialValue: Entitlements | null = null;
export const entitlementAtom = atom(initialValue);
