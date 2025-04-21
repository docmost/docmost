import { IsString } from 'class-validator';

export class DeleteSpaceDto {
  @IsString()
  spaceId: string;
}
