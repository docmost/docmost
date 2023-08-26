import {
  Controller,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { JwtGuard } from '../auth/guards/JwtGuard';
import { FastifyRequest } from 'fastify';
import { User } from './entities/user.entity';
import { Workspace } from '../workspace/entities/workspace.entity';

@UseGuards(JwtGuard)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @HttpCode(HttpStatus.OK)
  @Get('me')
  async getUser(@Req() req: FastifyRequest) {
    const jwtPayload = req['user'];
    const user: User = await this.userService.findById(jwtPayload.sub);

    if (!user) {
      throw new UnauthorizedException('Invalid user');
    }

    return { user };
  }

  @HttpCode(HttpStatus.OK)
  @Get('info')
  async getUserInfo(@Req() req: FastifyRequest) {
    const jwtPayload = req['user'];

    const data: { workspace: Workspace; user: User } =
      await this.userService.getUserInstance(jwtPayload.sub);

    return data;
  }
}
