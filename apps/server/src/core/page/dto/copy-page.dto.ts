import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CopyPageDto {
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  originPageId: string;

  @IsUUID()
  spaceId: string;

  @IsOptional()
  @IsString()
  parentPageId?: string;
}
