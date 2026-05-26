import { IsNotEmpty, IsUUID } from 'class-validator';

export class SaveDraftContentDto {
  @IsUUID()
  changeRequestId: string;

  @IsNotEmpty()
  content: any;
}
