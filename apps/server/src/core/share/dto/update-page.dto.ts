import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateShareDto {
  @IsString()
  @IsNotEmpty()
  shareId: string;
}
