import { IsString } from 'class-validator';

export class CreateShareDto {
  @IsString()
  pageId: string;
}
