import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateBaseDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsUUID()
  pageId?: string;

  @IsUUID()
  spaceId: string;
}
