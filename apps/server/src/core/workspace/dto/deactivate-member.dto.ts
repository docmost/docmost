import { IsString } from 'class-validator';

export class DeactivateMemberDto {
  @IsString()
  userId: string;

  @IsString()
  workspaceId: string;
}
