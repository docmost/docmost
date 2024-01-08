import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const JwtUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request['user'];
    return { id: user.sub, email: user.email };
  },
);
