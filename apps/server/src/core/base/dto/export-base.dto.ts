import { IsUUID } from 'class-validator';

export class ExportBaseCsvDto {
  @IsUUID()
  baseId: string;
}
