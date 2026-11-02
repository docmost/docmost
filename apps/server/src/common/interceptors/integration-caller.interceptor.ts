import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ClsService } from 'nestjs-cls';
import { JwtType } from '../../core/auth/dto/jwt-payload';
import { markIntegrationCaller } from '../helpers/integration-caller';

@Injectable()
export class IntegrationCallerInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() === 'http') {
      const request = context.switchToHttp().getRequest();
      if (request.user?.authType === JwtType.OAUTH_ACCESS) {
        markIntegrationCaller(this.cls);
      }
    }

    return next.handle();
  }
}
