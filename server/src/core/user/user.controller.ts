import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtGuard } from '../auth/guards/JwtGuard';
import { FastifyRequest } from 'fastify';
import { User } from './entities/user.entity';

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
}
