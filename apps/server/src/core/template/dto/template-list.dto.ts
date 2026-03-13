import { IsOptional, IsUUID } from 'class-validator';

export class TemplateListDto {
  @IsOptional()
  @IsUUID()
  spaceId?: string;
}
