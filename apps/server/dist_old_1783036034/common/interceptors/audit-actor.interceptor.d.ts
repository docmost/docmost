import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ClsService } from 'nestjs-cls';
export declare class AuditActorInterceptor implements NestInterceptor {
    private readonly cls;
    constructor(cls: ClsService);
    intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
}
