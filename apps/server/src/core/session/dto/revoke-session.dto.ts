import { IsNotEmpty, IsUUID } from 'class-validator';

export class RevokeSessionDto {
  @IsUUID()
  @IsNotEmpty()
  sessionId: string;
}
