import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateBaseDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  // Either `spaceId` or `parentPageId` must be supplied. When
  // parentPageId is given, the base is being inserted as an inline
  // embed inside that page — spaceId/workspaceId are derived from
  // the parent and the seeded shape includes a couple of default
  // columns + one row. When only spaceId is supplied, the base is a
  // standalone page in that space's tree. The controller validates
  // the cross-field requirement and picks the right permission gate.
  @IsUUID()
  @IsOptional()
  spaceId?: string;

  @IsUUID()
  @IsOptional()
  parentPageId?: string;
}
