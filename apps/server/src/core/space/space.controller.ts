import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { SpaceService } from './space.service';

@UseGuards(JwtGuard)
@Controller('spaces')
export class SpaceController {
  constructor(private readonly spaceService: SpaceService) {}

  // get all spaces user is a member of
  @HttpCode(HttpStatus.OK)
  @Post('/')
  async getUserSpaces(@Req() req: FastifyRequest) {}
}
