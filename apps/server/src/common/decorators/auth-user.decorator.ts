import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { anonymous } from '../helpers';

export const AuthUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    if (request.isPublishedSpace) {
      return anonymous;
    }

    if (!request?.user?.user) {
      throw new BadRequestException('Invalid User');
    }

    return request.user.user;
  },
);
