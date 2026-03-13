import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UseTemplateDto {
  @IsString()
  @IsUUID()
  templateId: string;

  @IsString()
  @IsUUID()
  spaceId: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  parentPageId?: string;
}
