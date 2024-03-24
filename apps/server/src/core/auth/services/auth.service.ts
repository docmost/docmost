import { Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from '../dto/login.dto';
import { User } from '../../user/entities/user.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { UserService } from '../../user/user.service';
import { TokenService } from './token.service';
import { TokensDto } from '../dto/tokens.dto';
import { UserRepository } from '../../user/repositories/user.repository';
import { comparePasswordHash } from '../auth.utils';
import { SignupService } from './signup.service';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private signupService: SignupService,
    private tokenService: TokenService,
    private userRepository: UserRepository,
  ) {}

  async login(loginDto: LoginDto, workspaceId: string) {
    const user = await this.userRepository.findOneByEmail(
      loginDto.email,
      workspaceId,
    );

    if (
      !user ||
      !(await comparePasswordHash(loginDto.password, user.password))
    ) {
      throw new UnauthorizedException('email or password does not match');
    }

    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    const tokens: TokensDto = await this.tokenService.generateTokens(user);
    return { tokens };
  }

  async register(createUserDto: CreateUserDto, workspaceId: string) {
    const user: User = await this.signupService.signup(
      createUserDto,
      workspaceId,
    );

    const tokens: TokensDto = await this.tokenService.generateTokens(user);

    return { tokens };
  }

  async setup(createAdminUserDto: CreateAdminUserDto) {
    const user: User =
      await this.signupService.initialSetup(createAdminUserDto);

    const tokens: TokensDto = await this.tokenService.generateTokens(user);

    return { tokens };
  }
}
