import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class CreateAdminUserDto extends CreateUserDto {
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(35)
  name: string;

  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(35)
  @IsString()
  workspaceName: string;
}
