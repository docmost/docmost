import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePageDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  parentPageId?: string;
}
