import { IsNotEmpty, IsUUID } from 'class-validator';

export class FileTaskIdDto {
  @IsNotEmpty()
  @IsUUID()
  fileTaskId: string;
}
