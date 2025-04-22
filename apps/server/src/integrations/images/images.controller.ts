import {
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Get,
  UseGuards,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ImagesService } from './images.service';

@Controller()
export class ImagesController {
  private readonly logger = new Logger(ImagesController.name);

  constructor(
    private readonly imagesService: ImagesService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Get('/images/search')
  async imagesSearch(@Query() query: { type?: string, page?: number; pageSize?: number; query?: string, orientation?: string }) {
    const searchTerm = query.query || '';
    const orientation = query.orientation || 'any';
    const type = query.type || 'unsplash';
    const pageSize = query.pageSize ? query.pageSize : 10;
    const page = query.page ? (query.page - 1) * pageSize : 0;
    return this.imagesService.search(searchTerm, orientation, type, page, pageSize, '', '');
  }
}
