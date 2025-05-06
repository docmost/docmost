import { IsOptional, IsString } from 'class-validator';

export class MyPagesDto {
  @IsString()
  @IsOptional()
  pageId?: string;
}
