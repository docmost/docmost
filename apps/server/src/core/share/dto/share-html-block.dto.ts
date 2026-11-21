import { IsUUID } from 'class-validator';

export class ShareHtmlBlockDto {
  @IsUUID()
  shareId: string;

  @IsUUID()
  htmlBlockId: string;
}
