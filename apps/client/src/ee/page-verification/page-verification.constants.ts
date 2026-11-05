import { VerificationStatus } from "@/ee/page-verification/types/page-verification.types";

export const LOCKED_VERIFICATION_STATUSES: VerificationStatus[] = [
  "approved",
  "in_approval",
  "verified",
  "expiring",
];
