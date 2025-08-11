import { IsNotEmpty, IsString } from 'class-validator';

export class DeletedPageDto {
  @IsNotEmpty()
  @IsString()
  spaceId: string;
}