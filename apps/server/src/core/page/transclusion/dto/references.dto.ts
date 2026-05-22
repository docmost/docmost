import { IsString, IsUUID } from 'class-validator';

export class ReferencesDto {
  @IsUUID()
  sourcePageId!: string;

  @IsString()
  transclusionId!: string;
}
