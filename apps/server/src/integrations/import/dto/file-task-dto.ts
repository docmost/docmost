import { IsNotEmpty, IsUUID } from 'class-validator';

export class FileTaskIdDto {
  @IsNotEmpty()
  @IsUUID()
  fileTaskId: string;
}

export type ImportPageNode = {
  id: string;
  slugId: string;
  name: string;
  content: string;
  position?: string | null;
  parentPageId: string | null;
  fileExtension: string;
  filePath: string;
};