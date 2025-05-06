import { IsNotEmpty, IsString } from 'class-validator';

export class MyPageColorDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsNotEmpty()
  @IsNotEmpty()
  color: string;
}
