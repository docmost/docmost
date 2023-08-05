import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { LoginDto } from '../dto/login.dto';
import { User } from '../../user/entities/user.entity';
import { CreateUserDto } from '../../user/dto/create-user.dto';
import { UserService } from '../../user/user.service';
import { TokenService } from './token.service';

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

    const token: string = await this.tokenService.generateJwt(user);

    return { user, token };
  }

  async register(createUserDto: CreateUserDto) {
    const user: User = await this.userService.create(createUserDto);

    const token: string = await this.tokenService.generateJwt(user);

    return { user, token };
  }
}
