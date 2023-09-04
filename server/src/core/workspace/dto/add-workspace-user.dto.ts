import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class AddWorkspaceUserDto {
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @IsNotEmpty()
  @IsString()
  role: string;
}
