import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class ChangeSetScopeDto {
  @IsOptional()
  @IsString()
  pageId?: string;

  @IsOptional()
  @IsUUID()
  spaceId?: string;
}

export class ChangeSetIdDto {
  @IsUUID()
  changeSetId: string;
}

export class SetChangeLogSettingsDto extends ChangeSetScopeDto {
  @IsBoolean()
  enabled: boolean;
}
