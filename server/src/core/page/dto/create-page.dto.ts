import { IsOptional } from 'class-validator';

export class CreatePageDto {
  @IsOptional()
  title?: string;

  @IsOptional()
  content?: string;

  @IsOptional()
  parentPageId?: string;
}
