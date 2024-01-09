import { Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from '../dto/login.dto';
import { User } from '../../user/entities/user.entity';
import { CreateUserDto } from '../../user/dto/create-user.dto';
import { UserService } from '../../user/user.service';
import { TokenService } from './token.service';
import { TokensDto } from '../dto/tokens.dto';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private tokenService: TokenService,
  ) {}

  async login(loginDto: LoginDto) {
    const user: User = await this.userService.findByEmail(loginDto.email);
    const invalidCredentialsMessage = 'email or password does not match';

    if (
      !user ||
      !(await this.userService.compareHash(loginDto.password, user.password))
    ) {
      throw new UnauthorizedException(invalidCredentialsMessage);
    }

    user.lastLoginAt = new Date();

    const tokens: TokensDto = await this.tokenService.generateTokens(user);

    return { tokens };
  }

  async register(createUserDto: CreateUserDto) {
    const user: User = await this.userService.create(createUserDto);

    const tokens: TokensDto = await this.tokenService.generateTokens(user);

    return { tokens };
  }
}
