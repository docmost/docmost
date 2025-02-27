import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Reflector } from '@nestjs/core';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { extractPageSlugId } from '../helpers';
import { Space } from '@docmost/db/types/entity.types';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
      private reflector: Reflector,
      private pageRepo: PageRepo,
      private spaceRepo: SpaceRepo
  ) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    if (this.isPublicApi(context)) return true;

    try {
      const isJwtValid = await super.canActivate(context)
      return isJwtValid as boolean
    } catch (error) {
      const isPublishedSpace = await this.isPublishedSpace(context);
      if (isPublishedSpace) return true
      else throw error
    }
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }

  isPublicApi(context: ExecutionContext): boolean {
    return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  }

  async isPublishedSpace(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const referer = request?.headers?.referer;
  
    if (!referer) return false;
  
    try {
      const { pathname } = new URL(referer);
      const parts = pathname.split("/");
      const sIndex = parts.indexOf("s");
      
      let space: Space;

      if (sIndex === -1) {
        const pIndex = parts.indexOf("p");
        if (pIndex !== parts.length - 2) return false;
    
        const slug = extractPageSlugId(parts[parts.length - 1]);
        const page = await this.pageRepo.findById(slug);
        if (!page) return false;
    
        const { spaceId, workspaceId } = page;
        space = await this.spaceRepo.findById(spaceId, workspaceId);
      } else {
        const spaceName = parts[sIndex + 1]
        if (!spaceName) return false;

        space = await this.spaceRepo.findBySlug(spaceName)
      }

      if (!space) return false

      const { isPublished } = space
      request.isPublishedSpace = isPublished

      return isPublished
    } catch (error) {
      console.error('Invalid Referer URL:', referer);
    }
  
    return false;
  }
}