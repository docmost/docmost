import { IsNotEmpty, IsUUID } from 'class-validator';

export class UserIdDto {
  @IsNotEmpty()
  @IsUUID()
  userId: string;
}
