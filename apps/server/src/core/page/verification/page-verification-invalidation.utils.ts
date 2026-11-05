import { VerificationEditState } from './page-verification-invalidation.types';

export function getVerificationStateEnteredAt(
  verification: VerificationEditState,
): Date | null {
  const { type, status, verifiedAt, requestedAt } = verification;
  if (type === 'expiring') return verifiedAt;
  if (type === 'qms' && status === 'approved') return verifiedAt;
  if (type === 'qms' && status === 'in_approval') return requestedAt;
  return null;
}

export function shouldInvalidateVerification(
  verification: VerificationEditState,
  changedAt: Date | null,
  now: Date,
): boolean {
  const { type, status, verifiedAt, expiresAt, invalidatedAt } = verification;
  const isLockedState =
    (type === 'qms' && (status === 'approved' || status === 'in_approval')) ||
    (type === 'expiring' &&
      !invalidatedAt &&
      !!verifiedAt &&
      (!expiresAt || expiresAt > now));
  if (!isLockedState) return false;

  const enteredAt = getVerificationStateEnteredAt(verification);
  return !changedAt || !enteredAt || changedAt > enteredAt;
}
