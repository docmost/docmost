import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { AppRequest } from '../helpers/types/request';

export const AuthUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AppRequest>();

    if (!request.user) {
      throw new BadRequestException('Invalid User');
    }

    return request.user;
  },
);
