import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ClsService } from 'nestjs-cls';
import { AuditContext, AUDIT_CONTEXT_KEY } from '../middlewares/audit-context.middleware';

@Injectable()
export class AuditActorInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user?.user;

    if (user?.id) {
      const auditContext = this.cls.get<AuditContext>(AUDIT_CONTEXT_KEY);
      if (auditContext) {
        auditContext.actorId = user.id;
        this.cls.set(AUDIT_CONTEXT_KEY, auditContext);
      }
    }

    return next.handle();
  }
}
