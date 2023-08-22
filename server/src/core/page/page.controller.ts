import { Controller, Post, Body, Delete, Get, Param } from "@nestjs/common";
import { PageService } from './page.service';
import { CreatePageDto } from './dto/create-page.dto';

@Controller('page')
export class PageController {
  constructor(private readonly pageService: PageService) {}

  @Post('create')
  async create(@Body() createPageDto: CreatePageDto) {
    return this.pageService.create(createPageDto);
  }

  @Get('page/:id')
  async getPage(@Param('id') pageId: string) {
    return this.pageService.findById(pageId);
  }

  @Delete('delete/:id')
  async delete(@Param('id') pageId: string) {
    await this.pageService.delete(pageId);
  }
}
