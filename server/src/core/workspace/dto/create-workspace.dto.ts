import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateWorkspaceDto {
  @MinLength(4)
  @MaxLength(64)
  @IsString()
  name: string;

  @IsOptional()
  @MinLength(4)
  @MaxLength(30)
  @IsString()
  hostname?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
