import {
  IsBase64,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { MAX_ENCRYPTED_BLOB_LENGTH } from './page-encryption.dto';

export type ContentFormat = 'json' | 'markdown' | 'html';

export class CreatePageDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  parentPageId?: string;

  @IsUUID()
  spaceId: string;

  @IsOptional()
  content?: string | object;

  @ValidateIf((o) => o.content !== undefined)
  @Transform(({ value }) => value?.toLowerCase() ?? 'json')
  @IsIn(['json', 'markdown', 'html'])
  format?: ContentFormat;

  /**
   * Required when the parent page is encrypted: the new page's initial
   * ciphertext, encrypted with the parent section's DEK. A page inside an
   * encrypted section is never created in plaintext.
   */
  @IsOptional()
  @IsBase64()
  @MaxLength(MAX_ENCRYPTED_BLOB_LENGTH)
  encryptedBlob?: string;
}
