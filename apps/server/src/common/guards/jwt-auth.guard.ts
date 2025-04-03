import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Reflector } from '@nestjs/core';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { addDays } from 'date-fns';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private environmentService: EnvironmentService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, ctx: ExecutionContext) {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }

    this.setJoinedWorkspacesCookie(user, ctx);
    return user;
  }

  setJoinedWorkspacesCookie(user: any, ctx: ExecutionContext) {
    if (this.environmentService.isCloud()) {
      const req = ctx.switchToHttp().getRequest();
      const res = ctx.switchToHttp().getResponse();

      const workspaceId = user?.workspace?.id;
      let hosts = [];
      try {
        hosts = req.cookies.workspaces ? JSON.parse(req.cookies.hosts) : [];
      } catch (err) {
        /* empty */
      }

      if (!hosts.includes(workspaceId)) {
        hosts.push(workspaceId);
      }

      // todo: revisit
      res.setCookie('joinedWorkspaces', JSON.stringify(hosts), {
        httpOnly: false,
        domain: '.' + this.environmentService.getSubdomainHost(),
        path: '/',
        expires: addDays(new Date(), 365),
        secure: this.environmentService.isHttps(),
      });
    }
  }
}
