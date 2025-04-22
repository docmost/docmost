import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateSyncPageDto {
  @IsNotEmpty()
  @IsUUID('all')
  spaceId: string;

  @IsNotEmpty()
  @IsUUID('all')
  originPageId: string;

  @IsOptional()
  @IsString()
  parentPageId?: string;
}
