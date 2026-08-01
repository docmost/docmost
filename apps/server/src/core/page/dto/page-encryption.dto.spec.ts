// the decorators these DTOs are built from need the metadata polyfill that
// main.ts pulls in at bootstrap
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ConvertToDecryptedDto,
  ConvertToEncryptedDto,
  EncryptionMetaDto,
  UpdateEncryptedPageDto,
} from './page-encryption.dto';

/**
 * These rules are what stops a client from installing encryption settings that
 * weaken a section for everyone who opens it afterwards, or from sending a
 * value that reaches the database as a malformed query. They are security
 * boundaries, not shape checks, so each one is asserted individually.
 */
async function errorsFor<T extends object>(
  cls: new () => T,
  payload: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(cls, payload);
  // same options as the global ValidationPipe in main.ts, so a DTO that passes
  // here is one that passes in production
  const errors = await validate(dto as object, {
    whitelist: true,
    stopAtFirstError: true,
  });
  return errors.map((e) => e.property);
}

/** base64 of `size` bytes — the shapes the client actually produces */
const material = (size: number) => Buffer.alloc(size, 7).toString('base64');

const validMeta = {
  algo: 'AES-256-GCM',
  kdf: 'PBKDF2-SHA256',
  iterations: 600_000,
  salt: material(16),
  // IV(12) + wrapped key(32) + GCM tag(16)
  wrappedDek: material(60),
  // IV(12) + the check plaintext + GCM tag(16)
  dekCheck: material(46),
};

describe('EncryptionMetaDto', () => {
  it('accepts the parameters this version produces', async () => {
    expect(await errorsFor(EncryptionMetaDto, validMeta)).toEqual([]);
  });

  it('rejects a work factor below the floor, which would make the wrapped key cheap to attack offline', async () => {
    expect(
      await errorsFor(EncryptionMetaDto, { ...validMeta, iterations: 1 }),
    ).toContain('iterations');
    expect(
      await errorsFor(EncryptionMetaDto, { ...validMeta, iterations: 599_999 }),
    ).toContain('iterations');
  });

  it('rejects a work factor so large it would lock up the browser that opens the page', async () => {
    expect(
      await errorsFor(EncryptionMetaDto, {
        ...validMeta,
        iterations: 10_000_000_000,
      }),
    ).toContain('iterations');
  });

  it('rejects a fractional work factor', async () => {
    expect(
      await errorsFor(EncryptionMetaDto, {
        ...validMeta,
        iterations: 600_000.5,
      }),
    ).toContain('iterations');
  });

  it('rejects ciphers and KDFs this version cannot read', async () => {
    expect(
      await errorsFor(EncryptionMetaDto, { ...validMeta, algo: 'AES-128-CBC' }),
    ).toContain('algo');
    expect(
      await errorsFor(EncryptionMetaDto, { ...validMeta, kdf: 'MD5' }),
    ).toContain('kdf');
  });

  it('rejects a salt too short to keep derivations distinct between sections', async () => {
    expect(
      await errorsFor(EncryptionMetaDto, { ...validMeta, salt: 'YWJj' }),
    ).toContain('salt');
  });

  it('rejects key material too short to be a wrapped 256-bit key', async () => {
    expect(
      await errorsFor(EncryptionMetaDto, { ...validMeta, wrappedDek: 'YWJj' }),
    ).toContain('wrappedDek');
    expect(
      await errorsFor(EncryptionMetaDto, { ...validMeta, dekCheck: 'YWJj' }),
    ).toContain('dekCheck');
  });

  it('rejects key material far larger than a wrapped key can be', async () => {
    expect(
      await errorsFor(EncryptionMetaDto, {
        ...validMeta,
        wrappedDek: 'QQ=='.repeat(200),
      }),
    ).toContain('wrappedDek');
  });
});

describe('ConvertToEncryptedDto', () => {
  const base = {
    pageId: 'e0a3b6e0-0000-4000-8000-000000000000',
    encryptionMeta: validMeta,
    encryptedBlob: 'Y2lwaGVy',
    snapshotUpdatedAt: '2026-07-30T12:00:00.000Z',
    acknowledgeDataDeletion: true,
  };

  it('accepts a well-formed conversion', async () => {
    expect(await errorsFor(ConvertToEncryptedDto, base)).toEqual([]);
  });

  it('requires the manifest snapshot timestamp the staleness check compares', async () => {
    expect(
      await errorsFor(ConvertToEncryptedDto, {
        ...base,
        snapshotUpdatedAt: undefined,
      }),
    ).toContain('snapshotUpdatedAt');
  });

  it('rejects a snapshot timestamp that is not a date, as a 400 rather than an opaque conflict', async () => {
    expect(
      await errorsFor(ConvertToEncryptedDto, {
        ...base,
        snapshotUpdatedAt: 'not-a-date',
      }),
    ).toContain('snapshotUpdatedAt');
  });

  it('requires the snapshot timestamp on every descendant, not just the root', async () => {
    expect(
      await errorsFor(ConvertToEncryptedDto, {
        ...base,
        descendants: [{ pageId: 'page-1', encryptedBlob: 'Y2lwaGVy' }],
      }),
    ).toContain('descendants');
  });

  it('refuses to convert without acknowledging the data it destroys', async () => {
    expect(
      await errorsFor(ConvertToEncryptedDto, {
        ...base,
        acknowledgeDataDeletion: undefined,
      }),
    ).toContain('acknowledgeDataDeletion');
    expect(
      await errorsFor(ConvertToEncryptedDto, {
        ...base,
        acknowledgeDataDeletion: false,
      }),
    ).toContain('acknowledgeDataDeletion');
  });

  it('caps the subtree so one request cannot lock the whole page table', async () => {
    const descendants = Array.from({ length: 201 }, (_, i) => ({
      pageId: `page-${i}`,
      encryptedBlob: 'Y2lwaGVy',
      snapshotUpdatedAt: '2026-07-30T12:00:00.000Z',
    }));
    expect(
      await errorsFor(ConvertToEncryptedDto, { ...base, descendants }),
    ).toContain('descendants');
  });
});

describe('ConvertToDecryptedDto', () => {
  const base = {
    pageId: 'e0a3b6e0-0000-4000-8000-000000000000',
    content: { type: 'doc' },
    baseVersion: 3,
    acknowledgeDataDeletion: true,
  };

  it('accepts a well-formed decryption', async () => {
    expect(await errorsFor(ConvertToDecryptedDto, base)).toEqual([]);
  });

  it('requires the manifest version the overwrite guard compares', async () => {
    expect(
      await errorsFor(ConvertToDecryptedDto, {
        ...base,
        baseVersion: undefined,
      }),
    ).toContain('baseVersion');
    expect(
      await errorsFor(ConvertToDecryptedDto, {
        ...base,
        descendants: [{ pageId: 'page-1', content: { type: 'doc' } }],
      }),
    ).toContain('descendants');
  });

  it('refuses to remove encryption without acknowledging what it discards', async () => {
    // removing encryption drops the encrypted history and overwrites the
    // ciphertext wholesale — as destructive as the encrypt direction
    expect(
      await errorsFor(ConvertToDecryptedDto, {
        ...base,
        acknowledgeDataDeletion: false,
      }),
    ).toContain('acknowledgeDataDeletion');
  });
});

describe('UpdateEncryptedPageDto', () => {
  const base = {
    pageId: 'e0a3b6e0-0000-4000-8000-000000000000',
    encryptedBlob: 'Y2lwaGVy',
    baseVersion: 3,
  };

  it('accepts a well-formed save', async () => {
    expect(await errorsFor(UpdateEncryptedPageDto, base)).toEqual([]);
  });

  it('rejects a fractional version, which would reach the bigint column as a comparison that can never match', async () => {
    expect(
      await errorsFor(UpdateEncryptedPageDto, { ...base, baseVersion: 1.5 }),
    ).toContain('baseVersion');
  });

  it('rejects a negative version', async () => {
    expect(
      await errorsFor(UpdateEncryptedPageDto, { ...base, baseVersion: -1 }),
    ).toContain('baseVersion');
  });
});
