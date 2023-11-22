import { IsUUID } from 'class-validator';

export class HistoryDetailsDto {
  @IsUUID()
  id: string;
}
