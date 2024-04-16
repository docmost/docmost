import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePageDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsUUID()
  parentPageId?: string;

  @IsUUID()
  spaceId: string;
}
