import { VerificationStatus } from "@/ee/page-verification/types/page-verification.types";

export const LOCKED_VERIFICATION_STATUSES: VerificationStatus[] = [
  "approved",
  "in_approval",
  "verified",
  "expiring",
];

// node types whose drawing lives in a file both review sides share
export const DIAGRAM_NODE_TYPES = new Set(["drawio", "excalidraw"]);
