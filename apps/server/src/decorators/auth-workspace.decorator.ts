import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const AuthWorkspace = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user.workspace;
  },
);
