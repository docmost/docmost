import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class LookupReferenceDto {
  @IsUUID()
  sourcePageId!: string;

  @IsString()
  @MaxLength(36)
  transclusionId!: string;
}

export class LookupDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => LookupReferenceDto)
  references!: LookupReferenceDto[];
}
