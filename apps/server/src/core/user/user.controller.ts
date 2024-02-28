import {
  Controller,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  UnauthorizedException,
  Post,
  Body,
} from '@nestjs/common';
import { UserService } from './user.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { FastifyRequest } from 'fastify';
import { User } from './entities/user.entity';
import { Workspace } from '../workspace/entities/workspace.entity';
import { UpdateUserDto } from './dto/update-user.dto';

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

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async updateUser(
    @Req() req: FastifyRequest,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const jwtPayload = req['user'];

    return this.userService.update(jwtPayload.sub, updateUserDto);
  }
}
