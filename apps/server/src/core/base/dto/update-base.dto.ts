import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateBaseDto {
  @IsUUID()
  pageId: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;
}
