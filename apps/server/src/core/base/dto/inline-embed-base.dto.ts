import { IsUUID } from 'class-validator';

export class InlineEmbedBaseDto {
  @IsUUID()
  parentPageId!: string;
}
