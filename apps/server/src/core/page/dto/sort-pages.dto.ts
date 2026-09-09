import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SortPagesDto {
  @IsOptional()
  @IsString()
  spaceId?: string;

  @IsOptional()
  @IsString()
  parentPageId?: string | null;

  @IsNotEmpty()
  @IsString()
  @IsIn(['asc', 'desc'])
  direction: 'asc' | 'desc';
}
