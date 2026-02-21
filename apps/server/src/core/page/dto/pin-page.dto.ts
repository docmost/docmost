import { IsString } from 'class-validator';

export class PinPageDto {
  @IsString()
  pageId: string;
}
