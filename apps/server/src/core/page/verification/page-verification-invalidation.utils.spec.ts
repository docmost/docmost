import {
  getVerificationStateEnteredAt,
  isSameTitle,
  shouldInvalidateVerification,
  shouldRecordLegacyBaseline,
} from './page-verification-invalidation.utils';
import { VerificationEditState } from './page-verification-invalidation.types';

const VERIFIED_AT = new Date('2026-11-01T09:00:00.000Z');
const REQUESTED_AT = new Date('2026-11-03T09:00:00.000Z');
const CHANGED_AT = new Date('2026-11-05T11:00:00.000Z');
const NOW = new Date('2026-11-05T12:00:00.000Z');

const secondsFrom = (date: Date, seconds: number) =>
  new Date(date.getTime() + seconds * 1000);

const qms = (
  status: string,
  overrides: Partial<VerificationEditState> = {},
): VerificationEditState => ({
  type: 'qms',
  status,
  verifiedAt: VERIFIED_AT,
  requestedAt: REQUESTED_AT,
  expiresAt: null,
  invalidatedAt: null,
  verifiedHistoryId: null,
  ...overrides,
});

const expiring = (
  overrides: Partial<VerificationEditState> = {},
): VerificationEditState => ({
  type: 'expiring',
  status: null,
  verifiedAt: VERIFIED_AT,
  requestedAt: null,
  expiresAt: new Date('2026-12-01T00:00:00.000Z'),
  invalidatedAt: null,
  verifiedHistoryId: null,
  ...overrides,
});

describe('getVerificationStateEnteredAt', () => {
  it('returns verifiedAt for an approved qms page', () => {
    expect(getVerificationStateEnteredAt(qms('approved'))).toEqual(VERIFIED_AT);
  });

  it('returns requestedAt for a qms page in approval', () => {
    expect(getVerificationStateEnteredAt(qms('in_approval'))).toEqual(
      REQUESTED_AT,
    );
  });

  it('returns verifiedAt for an expiring verification', () => {
    expect(getVerificationStateEnteredAt(expiring())).toEqual(VERIFIED_AT);
  });

  it.each(['draft', 'obsolete'])('returns null for qms %s', (status) => {
    expect(getVerificationStateEnteredAt(qms(status))).toBeNull();
  });
});

describe('shouldInvalidateVerification', () => {
  it.each(['approved', 'in_approval'])('invalidates qms %s', (status) => {
    expect(shouldInvalidateVerification(qms(status), CHANGED_AT, NOW)).toBe(
      true,
    );
  });

  it.each(['draft', 'obsolete'])('keeps qms %s', (status) => {
    expect(shouldInvalidateVerification(qms(status), CHANGED_AT, NOW)).toBe(
      false,
    );
  });

  it.each([
    ['with a future expiry', new Date('2026-12-01T00:00:00.000Z')],
    ['without an expiry', null],
  ])('invalidates a verified expiring page %s', (_label, expiresAt) => {
    expect(
      shouldInvalidateVerification(expiring({ expiresAt }), CHANGED_AT, NOW),
    ).toBe(true);
  });

  it('keeps an expired expiring page', () => {
    const expired = expiring({
      expiresAt: new Date('2026-11-04T00:00:00.000Z'),
    });
    expect(shouldInvalidateVerification(expired, CHANGED_AT, NOW)).toBe(false);
  });

  it('keeps an expiring page that is already invalidated', () => {
    const invalidated = expiring({
      invalidatedAt: new Date('2026-11-04T00:00:00.000Z'),
    });
    expect(shouldInvalidateVerification(invalidated, CHANGED_AT, NOW)).toBe(
      false,
    );
  });

  it('keeps an expiring page that was never verified', () => {
    const unverified = expiring({ verifiedAt: null });
    expect(shouldInvalidateVerification(unverified, CHANGED_AT, NOW)).toBe(
      false,
    );
  });

  it('ignores a change received at or before the state was entered', () => {
    expect(
      shouldInvalidateVerification(qms('approved'), VERIFIED_AT, NOW),
    ).toBe(false);
    expect(
      shouldInvalidateVerification(
        qms('in_approval'),
        secondsFrom(REQUESTED_AT, -1),
        NOW,
      ),
    ).toBe(false);
    expect(
      shouldInvalidateVerification(
        expiring(),
        secondsFrom(VERIFIED_AT, -1),
        NOW,
      ),
    ).toBe(false);
  });

  it('invalidates on a change received after the state was entered', () => {
    expect(
      shouldInvalidateVerification(
        qms('approved'),
        secondsFrom(VERIFIED_AT, 1),
        NOW,
      ),
    ).toBe(true);
    expect(
      shouldInvalidateVerification(
        qms('in_approval'),
        secondsFrom(REQUESTED_AT, 1),
        NOW,
      ),
    ).toBe(true);
    expect(
      shouldInvalidateVerification(
        expiring(),
        secondsFrom(VERIFIED_AT, 1),
        NOW,
      ),
    ).toBe(true);
  });

  it('invalidates when the change time is unknown', () => {
    expect(shouldInvalidateVerification(qms('approved'), null, NOW)).toBe(true);
  });
});

describe('isSameTitle', () => {
  it('returns true for equal titles', () => {
    expect(isSameTitle('Release notes', 'Release notes')).toBe(true);
  });

  it('ignores leading and trailing spaces', () => {
    expect(isSameTitle('Release notes ', 'Release notes')).toBe(true);
    expect(isSameTitle(' Release notes', 'Release notes')).toBe(true);
  });

  it('ignores repeated spaces', () => {
    expect(isSameTitle('Release  notes', 'Release notes')).toBe(true);
  });

  it('treats null, undefined and empty titles as the same', () => {
    expect(isSameTitle(null, '')).toBe(true);
    expect(isSameTitle(undefined, '')).toBe(true);
    expect(isSameTitle(null, '  ')).toBe(true);
  });

  it('detects a real change', () => {
    expect(isSameTitle('Release notes', 'Release notes v2')).toBe(false);
    expect(isSameTitle(null, 'Release notes')).toBe(false);
  });
});

describe('shouldRecordLegacyBaseline', () => {
  it('is true for approved qms without a pointer', () => {
    expect(shouldRecordLegacyBaseline(qms('approved'))).toBe(true);
  });

  it('is false for approved qms with a pointer', () => {
    expect(
      shouldRecordLegacyBaseline(qms('approved', { verifiedHistoryId: 'h1' })),
    ).toBe(false);
  });

  it('is false for qms in approval without a pointer', () => {
    expect(shouldRecordLegacyBaseline(qms('in_approval'))).toBe(false);
  });

  it('is true for expiring without a pointer', () => {
    expect(shouldRecordLegacyBaseline(expiring())).toBe(true);
  });

  it('is false for expiring with a pointer', () => {
    expect(
      shouldRecordLegacyBaseline(expiring({ verifiedHistoryId: 'h1' })),
    ).toBe(false);
  });
});
