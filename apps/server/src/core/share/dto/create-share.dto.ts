import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateShareDto {
  @IsString()
  pageId: string;

  @IsBoolean()
  @IsOptional()
  includeSubPages: boolean;
}
