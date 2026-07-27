import {
  IsArray,
  IsBase64,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Client-generated encryption metadata. The server never interprets the
 * cryptographic fields; it only stores and returns them.
 */
export class EncryptionMetaDto {
  @IsString()
  @IsNotEmpty()
  algo: string;

  @IsString()
  @IsNotEmpty()
  kdf: string;

  @IsNumber()
  iterations: number;

  @IsBase64()
  salt: string;

  @IsBase64()
  wrappedDek: string;

  @IsBase64()
  dekCheck: string;
}

/** one descendant's ciphertext in a subtree conversion */
export class EncryptedDescendantDto {
  @IsString()
  pageId: string;

  @IsBase64()
  encryptedBlob: string;
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
  encryptedBlob: string;

  /**
   * Every descendant of the root, each encrypted with the SAME DEK. Must
   * match the server-side subtree exactly or the conversion is rejected.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EncryptedDescendantDto)
  descendants?: EncryptedDescendantDto[];
}

export class UpdateEncryptedPageDto {
  @IsString()
  pageId: string;

  @IsBase64()
  encryptedBlob: string;

  @IsNumber()
  baseVersion: number;

  @IsOptional()
  @IsBoolean()
  saveHistory?: boolean;

  @IsOptional()
  @IsString()
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
  currentWrappedDek: string;
}

/** one descendant's plaintext in a subtree decryption */
export class DecryptedDescendantDto {
  @IsString()
  pageId: string;

  @IsObject()
  content: object;
}

export class ConvertToDecryptedDto {
  @IsString()
  pageId: string;

  /** decrypted prosemirror JSON, produced client-side */
  @IsObject()
  content: object;

  /**
   * Every page keyed to this root. Must match the server-side set exactly,
   * so no page is left pointing at a root that no longer holds a key.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DecryptedDescendantDto)
  descendants?: DecryptedDescendantDto[];
}
