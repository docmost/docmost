import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class TemplateIdDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  templateId: string;
}
