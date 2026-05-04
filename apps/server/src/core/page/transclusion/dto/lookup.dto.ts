import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class LookupReferenceDto {
  @IsUUID()
  sourcePageId!: string;

  @IsString()
  transclusionId!: string;
}

export class LookupDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => LookupReferenceDto)
  references!: LookupReferenceDto[];
}
