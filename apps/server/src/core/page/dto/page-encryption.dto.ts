import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsBase64,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_ENCRYPTED_TREE_PAGES } from '../page-encryption.util';

/** the only primitives this version reads or writes; see the client's crypto.ts */
const SUPPORTED_ALGOS = ['AES-256-GCM'];
const SUPPORTED_KDFS = ['PBKDF2-SHA256'];

/**
 * Bounds on the key-derivation work factor. The server cannot read the
 * content, but it does hand this metadata to every member of the space, so it
 * must not store a work factor that makes the wrapped key cheap to attack
 * offline — nor one so large it locks up the browser of whoever opens the
 * page. The client enforces the same range on the way back in.
 */
const MIN_KDF_ITERATIONS = 600_000;
const MAX_KDF_ITERATIONS = 10_000_000;

/** generous ceilings: these are fixed-size key material, not user content */
const MAX_SALT_LENGTH = 64;
const MAX_KEY_MATERIAL_LENGTH = 256;
/** base64 of 16 salt bytes */
const MIN_SALT_LENGTH = 24;
/** base64 of IV(12) + key(32) + tag(16) */
const MIN_WRAPPED_DEK_LENGTH = 80;
/** base64 of IV(12) + tag(16) + at least one byte of check plaintext */
const MIN_DEK_CHECK_LENGTH = 40;
/**
 * Base64 characters, so roughly a 6 MiB document — far beyond any realistic
 * page. Kept below the server's body limit (see main.ts) so an oversized save
 * is refused by validation with a clear message rather than by the transport.
 */
export const MAX_ENCRYPTED_BLOB_LENGTH = 8_000_000;
const MAX_BLOB_LENGTH = MAX_ENCRYPTED_BLOB_LENGTH;
const MAX_TITLE_LENGTH = 500;

/**
 * Client-generated encryption metadata. The server never interprets the
 * cryptographic fields; it only stores and returns them — but it does check
 * that they name parameters this version supports, so a client cannot install
 * settings that weaken the section for everyone who opens it afterwards.
 */
export class EncryptionMetaDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @IsIn(SUPPORTED_ALGOS)
  algo: string;

  @IsIn(SUPPORTED_KDFS)
  kdf: string;

  @IsInt()
  @Min(MIN_KDF_ITERATIONS)
  @Max(MAX_KDF_ITERATIONS)
  iterations: number;

  // Minimums as well as maximums: a salt shorter than 16 bytes makes the
  // derivation cheap to attack across sections no matter how many iterations
  // it runs, and key material shorter than IV+key+tag cannot be a wrapped
  // 256-bit key at all. Lengths are in base64 characters — see the client's
  // crypto.ts, which enforces the same bounds on the decoded bytes.
  @IsBase64()
  @MinLength(MIN_SALT_LENGTH)
  @MaxLength(MAX_SALT_LENGTH)
  salt: string;

  @IsBase64()
  @MinLength(MIN_WRAPPED_DEK_LENGTH)
  @MaxLength(MAX_KEY_MATERIAL_LENGTH)
  wrappedDek: string;

  @IsBase64()
  @MinLength(MIN_DEK_CHECK_LENGTH)
  @MaxLength(MAX_KEY_MATERIAL_LENGTH)
  dekCheck: string;
}

/** one descendant's ciphertext in a subtree conversion */
export class EncryptedDescendantDto {
  @IsString()
  pageId: string;

  @IsBase64()
  @MaxLength(MAX_BLOB_LENGTH)
  encryptedBlob: string;

  /**
   * The page's updatedAt as returned by the section manifest. The conversion
   * compares it against the row under lock and rejects with a conflict if the
   * page was edited after the manifest was snapshotted — the ciphertext was
   * produced from the manifest's content, so writing it would silently
   * destroy those edits (and the history purge makes that unrecoverable).
   */
  @IsISO8601({ strict: true })
  snapshotUpdatedAt: string;
}

/** where to place the converted page, applied in the conversion transaction */
export class ConvertMoveDto {
  @IsString()
  parentPageId: string;

  @IsString()
  position: string;
}

export class ConvertToEncryptedDto {
  @IsString()
  pageId: string;

  /**
   * Key metadata for a new encrypted section. Mutually exclusive with
   * encryptionRootId — a page either starts a section or joins one.
   */
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => EncryptionMetaDto)
  encryptionMeta?: EncryptionMetaDto;

  /**
   * Join an existing section instead of starting one: the pages are encrypted
   * with that section's DEK and keyed to its root.
   */
  @IsOptional()
  @IsString()
  encryptionRootId?: string;

  /**
   * Set when the conversion is a drag into an encrypted section. Converting
   * and moving must be one transaction, or a failure in between would leave
   * pages encrypted with a key their location cannot reach.
   */
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ConvertMoveDto)
  move?: ConvertMoveDto;

  /** the root page's ciphertext */
  @IsBase64()
  @MaxLength(MAX_BLOB_LENGTH)
  encryptedBlob: string;

  /** the root page's manifest updatedAt; see EncryptedDescendantDto */
  @IsISO8601({ strict: true })
  snapshotUpdatedAt: string;

  /**
   * Every descendant of the root, each encrypted with the SAME DEK. Must
   * match the server-side subtree exactly or the conversion is rejected.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ENCRYPTED_TREE_PAGES)
  @ValidateNested({ each: true })
  @Type(() => EncryptedDescendantDto)
  descendants?: EncryptedDescendantDto[];

  /**
   * Explicit acknowledgement that converting discards data the server cannot
   * re-encrypt: page history, comments, shares, backlinks and transclusions
   * for every page in the subtree. Unlike deleting a page this is not
   * recoverable from the trash, so the destruction is never implied by the
   * request alone — the client must have shown the warning and been confirmed.
   */
  @Equals(true)
  acknowledgeDataDeletion: boolean;
}

export class UpdateEncryptedPageDto {
  @IsString()
  pageId: string;

  @IsBase64()
  @MaxLength(MAX_BLOB_LENGTH)
  encryptedBlob: string;

  // must be a whole number: it is compared against a bigint column, and a
  // fractional value would be stringified into a comparison that can never
  // match and surface as an unhandled database error
  @IsInt()
  @Min(0)
  baseVersion: number;

  @IsOptional()
  @IsBoolean()
  saveHistory?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_TITLE_LENGTH)
  title?: string;
}

export class EncryptedBlobDto {
  @IsString()
  pageId: string;
}

export class RewrapEncryptionKeyDto {
  @IsString()
  pageId: string;

  @IsObject()
  @ValidateNested()
  @Type(() => EncryptionMetaDto)
  encryptionMeta: EncryptionMetaDto;

  /** the wrappedDek currently stored on the page — compare-and-swap guard */
  @IsBase64()
  @MaxLength(MAX_KEY_MATERIAL_LENGTH)
  currentWrappedDek: string;
}

/** one descendant's plaintext in a subtree decryption */
export class DecryptedDescendantDto {
  @IsString()
  pageId: string;

  @IsObject()
  content: object;

  /**
   * The encryptedVersion the manifest reported for this page. Compared under
   * the row locks: the plaintext was decrypted from that version's blob, so
   * writing it over a newer one would silently destroy the newer save — and
   * decryption drops the encrypted history that could have recovered it.
   */
  @IsInt()
  @Min(0)
  baseVersion: number;
}

export class ConvertToDecryptedDto {
  @IsString()
  pageId: string;

  /** decrypted prosemirror JSON, produced client-side */
  @IsObject()
  content: object;

  /** the root page's manifest encryptedVersion; see DecryptedDescendantDto */
  @IsInt()
  @Min(0)
  baseVersion: number;

  /**
   * Every page keyed to this root. Must match the server-side set exactly,
   * so no page is left pointing at a root that no longer holds a key.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ENCRYPTED_TREE_PAGES)
  @ValidateNested({ each: true })
  @Type(() => DecryptedDescendantDto)
  descendants?: DecryptedDescendantDto[];

  /**
   * Explicit acknowledgement that removing encryption is destructive in its
   * own right: the encrypted history is dropped, and the ciphertext is
   * replaced wholesale by whatever plaintext this request carries. Mirrors the
   * flag the encrypt direction requires.
   */
  @Equals(true)
  acknowledgeDataDeletion: boolean;
}
