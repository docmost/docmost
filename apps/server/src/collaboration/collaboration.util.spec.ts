import {
  isValidPageDocumentName,
  resolveCollabAccess,
} from './collaboration.util';

const PAGE_UUID = '01a14cce-2066-764a-ac88-48c347a93f31';

type AccessInput = Parameters<typeof resolveCollabAccess>[0];

const writerOnUncontrolledPage: AccessInput = {
  hasSpaceRole: true,
  restrictedNoAccess: false,
  canWrite: true,
  deleted: false,
  controlled: false,
  canAccessDraft: false,
  locked: false,
  hidden: false,
};

function access(overrides: Partial<AccessInput>) {
  return resolveCollabAccess({ ...writerOnUncontrolledPage, ...overrides });
}

describe('resolveCollabAccess', () => {
  it('gives no access to a page hidden from the user', () => {
    expect(access({ hidden: true })).toBe('none');
  });

  it('gives no access to a controlled page without draft access', () => {
    expect(
      access({ controlled: true, canAccessDraft: false, canWrite: false }),
    ).toBe('none');
  });

  it('gives read access to a locked controlled page with draft access', () => {
    expect(
      access({ controlled: true, canAccessDraft: true, locked: true }),
    ).toBe('read');
  });

  it('gives read access to a draft user who cannot write', () => {
    expect(
      access({ controlled: true, canAccessDraft: true, canWrite: false }),
    ).toBe('read');
  });

  it('gives write access to an editor of an unlocked controlled page', () => {
    expect(
      access({
        controlled: true,
        canAccessDraft: true,
        canWrite: true,
        locked: false,
      }),
    ).toBe('write');
  });

  it('gives read access to a reader of an uncontrolled page', () => {
    expect(access({ canWrite: false })).toBe('read');
  });

  it('gives read access to a writer on a deleted uncontrolled page', () => {
    expect(access({ deleted: true })).toBe('read');
  });

  it('gives no access without a space role', () => {
    expect(access({ hasSpaceRole: false })).toBe('none');
  });

  it('gives write access to a writer on an uncontrolled page', () => {
    expect(access({})).toBe('write');
  });

  it('gives no access to a restricted page the user cannot access', () => {
    expect(access({ restrictedNoAccess: true })).toBe('none');
  });

  it('gives read access to an editor of a deleted controlled page', () => {
    expect(
      access({ controlled: true, canAccessDraft: true, deleted: true }),
    ).toBe('read');
  });

  it('never lets draft access override a hidden page', () => {
    expect(
      access({ hidden: true, controlled: true, canAccessDraft: true }),
    ).toBe('none');
  });
});

describe('isValidPageDocumentName', () => {
  it('accepts page.<uuid>', () => {
    expect(isValidPageDocumentName(`page.${PAGE_UUID}`)).toBe(true);
  });

  it('rejects another prefix', () => {
    expect(isValidPageDocumentName(`x.${PAGE_UUID}`)).toBe(false);
  });

  it('rejects a slug id', () => {
    expect(isValidPageDocumentName('page.Ab12Cd34Ef')).toBe(false);
  });

  it('rejects extra segments', () => {
    expect(isValidPageDocumentName(`page.${PAGE_UUID}.draft`)).toBe(false);
  });

  it('rejects other spellings of the same uuid', () => {
    expect(isValidPageDocumentName(`page.${PAGE_UUID.toUpperCase()}`)).toBe(
      false,
    );
    expect(isValidPageDocumentName(`page.${PAGE_UUID.replace(/-/g, '')}`)).toBe(
      false,
    );
    expect(isValidPageDocumentName(`page.{${PAGE_UUID}}`)).toBe(false);
    expect(isValidPageDocumentName(`page.${PAGE_UUID}\n`)).toBe(false);
  });

  it('rejects empty and malformed names', () => {
    expect(isValidPageDocumentName('')).toBe(false);
    expect(isValidPageDocumentName('page.')).toBe(false);
    expect(isValidPageDocumentName(PAGE_UUID)).toBe(false);
    expect(isValidPageDocumentName(undefined as unknown as string)).toBe(false);
  });
});
