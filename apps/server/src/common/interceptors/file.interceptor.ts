import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { FastifyRequest } from 'fastify';

@Injectable()
export class FileInterceptor implements NestInterceptor {
  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const req: FastifyRequest = context.switchToHttp().getRequest();

    if (!req.isMultipart() || !req.file) {
      throw new BadRequestException('Invalid multipart content type');
    }

    return next.handle();
  }
}
