export enum VerificationStatus {
  VERIFIED = 'verified',
  EXPIRING = 'expiring',
  EXPIRED = 'expired',
  DRAFT = 'draft',
  IN_APPROVAL = 'in_approval',
  APPROVED = 'approved',
  OBSOLETE = 'obsolete',
  INVALIDATED = 'invalidated',
  NONE = 'none',
}

const EXPIRING_WINDOW_MS = 4 * 24 * 60 * 60 * 1000;

// keep in step with verifiedPageFilter (database/repos/page/verified-page-filter.ts) and resolveVerifiedUntil
export function resolveVerificationStatus(
  verification: {
    type: string;
    status: string | null;
    expiresAt: Date | null;
    invalidatedAt: Date | null;
  },
  now: Date = new Date(),
): VerificationStatus {
  if (verification.type === 'qms') {
    return (verification.status as VerificationStatus) ?? VerificationStatus.NONE;
  }
  if (verification.invalidatedAt) return VerificationStatus.INVALIDATED;
  if (!verification.expiresAt) return VerificationStatus.VERIFIED;

  const remaining = new Date(verification.expiresAt).getTime() - now.getTime();
  if (remaining <= 0) return VerificationStatus.EXPIRED;
  if (remaining <= EXPIRING_WINDOW_MS) return VerificationStatus.EXPIRING;
  return VerificationStatus.VERIFIED;
}

export const VERIFIED_FOREVER = Number.MAX_SAFE_INTEGER;

// must match verifiedPageFilter (database/repos/page/verified-page-filter.ts) and resolveVerificationStatus; changing it needs a Typesense reindex (documents keep the old value)
export function resolveVerifiedUntil(
  verification:
    | {
        type: string;
        status: string | null;
        expiresAt: Date | null;
        invalidatedAt: Date | null;
      }
    | null
    | undefined,
): number {
  if (!verification) return 0;
  if (verification.type === 'qms') {
    return verification.status === VerificationStatus.APPROVED
      ? VERIFIED_FOREVER
      : 0;
  }
  if (verification.invalidatedAt) return 0;
  if (!verification.expiresAt) return VERIFIED_FOREVER;
  return new Date(verification.expiresAt).getTime();
}
