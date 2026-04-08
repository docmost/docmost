import { IsString, IsNotEmpty } from 'class-validator';

export class SpaceWatcherDto {
  @IsString()
  @IsNotEmpty()
  spaceId: string;
}
