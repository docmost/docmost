import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { AppRequest } from '../helpers/types/request';

export const AuthWorkspace = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AppRequest>();

    const workspace = request.raw.workspace;

    if (!workspace) {
      throw new BadRequestException('Invalid workspace');
    }

    return workspace;
  },
);
