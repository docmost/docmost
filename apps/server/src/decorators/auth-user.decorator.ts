import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export const AuthUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    if (!request['user'] || !request['user'].user) {
      throw new UnauthorizedException();
    }

    return request['user'] ? request['user'].user : undefined;
  },
);
