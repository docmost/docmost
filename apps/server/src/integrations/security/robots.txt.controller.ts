import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';

@Controller('robots.txt')
export class RobotsTxtController {
  @SkipTransform()
  @HttpCode(HttpStatus.OK)
  @Get()
  async robotsTxt() {
    return 'Disallow: /login\nDisallow: /forgot-password';
  }
}
