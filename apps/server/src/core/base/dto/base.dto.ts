import { IsUUID } from 'class-validator';

export class BaseIdDto {
  @IsUUID()
  baseId: string;
}
