import { IsOptional, IsString } from 'class-validator';

export class CreatedByUserDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  spaceId?: string;
}
