import { IsOptional, IsString } from 'class-validator';

export class RecentPageDto {
  @IsOptional()
  @IsString()
  spaceId: string;
}
