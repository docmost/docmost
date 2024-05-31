import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class SpaceIdDto {
  @IsString()
  @IsNotEmpty()
  //@IsUUID()
  spaceId: string;
}
