import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { COMPLETION_FALLBACK_REDIRECT } from './oauth.utils';

// Redirects a browser back into the app instead of showing a JSON auth error.
@Catch(UnauthorizedException, ForbiddenException)
export class OAuthCompleteAuthFilter implements ExceptionFilter {
  private readonly logger = new Logger(OAuthCompleteAuthFilter.name);

  catch(
    exception: UnauthorizedException | ForbiddenException,
    host: ArgumentsHost,
  ) {
    const http = host.switchToHttp();
    this.logger.warn(
      `OAuth completion on ${http.getRequest<FastifyRequest>().host} refused without a usable session: ${exception.message}`,
    );
    http.getResponse<FastifyReply>().redirect(COMPLETION_FALLBACK_REDIRECT, 302);
  }
}
