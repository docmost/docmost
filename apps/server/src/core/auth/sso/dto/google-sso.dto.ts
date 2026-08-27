import { IsOptional, IsString, IsUUID } from 'class-validator';

export class GoogleLoginDto {
  @IsUUID()
  workspaceId: string;

  @IsOptional()
  @IsString()
  redirect?: string;
}

export class GoogleCallbackDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  error?: string;
}
