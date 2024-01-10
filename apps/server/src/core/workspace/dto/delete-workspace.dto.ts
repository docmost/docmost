import { IsString } from 'class-validator';

export class DeleteWorkspaceDto {
  @IsString()
  workspaceId: string;
}
