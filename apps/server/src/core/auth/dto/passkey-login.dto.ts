import { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class PasskeyLoginDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  authenticationResponse?: AuthenticationResponseJSON;
}
