import { IsOptional, IsString } from 'class-validator';

export class DeletedPageDto {
  @IsOptional()
  @IsString()
  spaceId: string;
}