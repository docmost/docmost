import { IsString, IsNotEmpty } from 'class-validator';

export class WatcherPageDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;
}
