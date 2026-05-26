import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../audit/audit.service';

const MUTATION_METHODS = ['POST', 'PATCH', 'DELETE'];

const ENTITY_KIND_MAP: Record<string, string> = {
  'change-requests': 'change_request',
  'services': 'service',
  'webhooks': 'webhook_config',
  'audit': 'audit_log',
  'dashboard': 'dashboard',
};

@Injectable()
export class DocOpsMutationInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, body, ip, headers } = req;

    if (!MUTATION_METHODS.includes(method) || !url.includes('/docops/')) {
      return next.handle();
    }

    const actorId: string | undefined = req.user?.user?.id;
    const entityKind = this.extractEntityKind(url);
    const entityId = this.extractEntityId(body);
    const action = this.buildAction(method, url);

    return next.handle().pipe(
      tap({
        next: () => {
          this.auditService.log({
            actorId,
            action,
            entityKind,
            entityId,
            ip: typeof ip === 'string' ? ip : undefined,
            userAgent: headers?.['user-agent'],
            payloadDiff: this.sanitizeBody(body),
          }).catch(() => {});
        },
        error: () => {
          this.auditService.log({
            actorId,
            action: `${action}.error`,
            entityKind,
            entityId,
            ip: typeof ip === 'string' ? ip : undefined,
            userAgent: headers?.['user-agent'],
          }).catch(() => {});
        },
      }),
    );
  }

  private extractEntityKind(url: string): string {
    const match = url.match(/\/docops\/([^/?]+)/);
    const segment = match?.[1] ?? 'unknown';
    return ENTITY_KIND_MAP[segment] ?? segment.replace(/-/g, '_');
  }

  private extractEntityId(body: any): string {
    if (!body || typeof body !== 'object') return '00000000-0000-0000-0000-000000000000';
    const uuid =
      body.id ??
      body.changeRequestId ??
      body.serviceId ??
      body.webhookId ??
      '00000000-0000-0000-0000-000000000000';
    return typeof uuid === 'string' ? uuid : '00000000-0000-0000-0000-000000000000';
  }

  private buildAction(method: string, url: string): string {
    const match = url.match(/\/docops\/(.+?)(?:\?|$)/);
    const path = match?.[1]?.replace(/\//g, '.') ?? 'unknown';
    return `http.${method}.${path}`;
  }

  private sanitizeBody(body: any): Record<string, any> | undefined {
    if (!body || typeof body !== 'object') return undefined;
    const { password, secret, token, ...safe } = body as Record<string, any>;
    return safe;
  }
}
