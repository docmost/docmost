import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export const CurrentWorkspace = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    if (!request['user'] || !request['user'].workspace) {
      throw new UnauthorizedException();
    }

    return request['user'] ? request['user'].workspace : undefined;
  },
);
