import { IsNotEmpty, IsUUID } from 'class-validator';

export class RemoveWorkspaceUserDto {
  @IsNotEmpty()
  @IsUUID()
  userId: string;
}
