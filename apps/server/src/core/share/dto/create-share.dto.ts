import { IsBoolean, IsString } from 'class-validator';

export class CreateShareDto {
  @IsString()
  pageId: string;

  @IsBoolean()
  includeSubPages: boolean;
}
