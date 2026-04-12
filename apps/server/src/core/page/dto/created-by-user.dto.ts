import { IsOptional, IsUUID } from 'class-validator';

export class CreatedByUserDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  spaceId?: string;
}
