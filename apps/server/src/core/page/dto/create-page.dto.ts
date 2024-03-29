import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePageDto {
  @IsOptional()
  @IsUUID()
  pageId?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  parentPageId?: string;

  @IsString()
  spaceId: string;
}
