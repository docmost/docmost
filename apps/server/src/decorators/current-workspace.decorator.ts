import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export const CurrentWorkspace = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    if (!request['user'] || !request['user'].workspace) {
      throw new UnauthorizedException('Workspace not found');
    }

    return request['user'] ? request['user'].workspace : undefined;
  },
);
