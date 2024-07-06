import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
export interface Response<T> {
  data: T;
}

@Injectable()
export class TransformHttpResponseInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<Response<T> | any> {
    const request = context.switchToHttp().getRequest();
    const path = request.url;

    // Skip interceptor for the /api/health path
    if (path === '/api/health') {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        const status = context.switchToHttp().getResponse().statusCode;
        return { data, success: true, status };
      }),
    );
  }
}
