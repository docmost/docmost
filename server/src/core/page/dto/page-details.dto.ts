import { IsUUID } from 'class-validator';

export class PageDetailsDto {
  @IsUUID()
  id: string;
}
