import { IsUUID } from 'class-validator';

export class DeletePageDto {
  @IsUUID()
  id: string;
}
