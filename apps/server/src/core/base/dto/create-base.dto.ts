import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateBaseDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsUUID()
  spaceId!: string;

  @IsUUID()
  @IsOptional()
  parentPageId?: string;
}
