import { IsJSON, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateReadOnlyCommentDto {
  @IsString()
  pageId: string;

  @IsJSON()
  content: any;

  @IsOptional()
  @IsString()
  selection: string;

  @IsObject()
  yjsSelection: {
    anchor: any;
    head: any;
  };
}
