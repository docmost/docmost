import { HttpException, HttpStatus } from '@nestjs/common';

export class SharePasswordRequiredException extends HttpException {
  constructor(shareId: string) {
    super(
      {
        message: 'Password required for this shared page',
        error: 'SHARE_PASSWORD_REQUIRED',
        shareId,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
