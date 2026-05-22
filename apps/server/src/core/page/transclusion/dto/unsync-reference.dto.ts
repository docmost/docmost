import { IsString, IsUUID } from 'class-validator';

export class UnsyncReferenceDto {
  @IsUUID()
  referencePageId!: string;

  @IsUUID()
  sourcePageId!: string;

  @IsString()
  transclusionId!: string;
}
