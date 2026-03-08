import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateBaseDto {
  @IsUUID()
  baseId: string;

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
