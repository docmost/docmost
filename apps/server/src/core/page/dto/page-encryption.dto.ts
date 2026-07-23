import {
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

export class ConvertToEncryptedDto {
  @IsString()
  pageId: string;

  @IsObject()
  @ValidateNested()
  @Type(() => EncryptionMetaDto)
  encryptionMeta: EncryptionMetaDto;

  @IsBase64()
  encryptedBlob: string;
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

export class ConvertToDecryptedDto {
  @IsString()
  pageId: string;

  /** decrypted prosemirror JSON, produced client-side */
  @IsObject()
  content: object;
}
