import {
  resolveVerificationStatus,
  VerificationStatus,
} from './page-verification-status.utils';

const now = new Date('2026-11-24T12:00:00Z');
const inDays = (days: number) =>
  new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
const base = { type: 'expiring', status: null, expiresAt: null, invalidatedAt: null };

describe('resolveVerificationStatus', () => {
  it('returns the stored status for an approved QMS verification', () => {
    expect(
      resolveVerificationStatus({ ...base, type: 'qms', status: 'approved' }, now),
    ).toBe(VerificationStatus.APPROVED);
  });

  it('returns the stored status for a QMS draft', () => {
    expect(
      resolveVerificationStatus({ ...base, type: 'qms', status: 'draft' }, now),
    ).toBe(VerificationStatus.DRAFT);
  });

  it('returns none for a QMS verification without a status', () => {
    expect(resolveVerificationStatus({ ...base, type: 'qms' }, now)).toBe(
      VerificationStatus.NONE,
    );
  });

  it('returns invalidated when the verification was invalidated', () => {
    expect(
      resolveVerificationStatus(
        { ...base, expiresAt: inDays(2), invalidatedAt: now },
        now,
      ),
    ).toBe(VerificationStatus.INVALIDATED);
  });

  it('returns verified for an indefinite verification', () => {
    expect(resolveVerificationStatus(base, now)).toBe(
      VerificationStatus.VERIFIED,
    );
  });

  it('returns expired once the expiry has passed', () => {
    expect(
      resolveVerificationStatus({ ...base, expiresAt: inDays(-1) }, now),
    ).toBe(VerificationStatus.EXPIRED);
  });

  it('returns expiring when it expires within 4 days', () => {
    expect(
      resolveVerificationStatus({ ...base, expiresAt: inDays(3) }, now),
    ).toBe(VerificationStatus.EXPIRING);
  });

  it('returns verified when it expires in more than 4 days', () => {
    expect(
      resolveVerificationStatus({ ...base, expiresAt: inDays(10) }, now),
    ).toBe(VerificationStatus.VERIFIED);
  });

  it('treats an expiry exactly at now as expired', () => {
    expect(
      resolveVerificationStatus({ ...base, expiresAt: now }, now),
    ).toBe(VerificationStatus.EXPIRED);
  });

  it('treats an expiry exactly four days away as expiring', () => {
    expect(
      resolveVerificationStatus({ ...base, expiresAt: inDays(4) }, now),
    ).toBe(VerificationStatus.EXPIRING);
  });
});
