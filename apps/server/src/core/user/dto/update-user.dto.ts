import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from '../../auth/dto/create-user.dto';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
) {
  @IsOptional()
  @IsString()
  avatarUrl: string;

  @IsOptional()
  @IsBoolean()
  fullPageWidth: boolean;

  @IsOptional()
  @IsString()
  locale: string;
}
