import { Injectable } from '@nestjs/common';
import { PageRepository } from './repositories/page.repository';
import { CreatePageDto } from './dto/create-page.dto';

@Injectable()
export class PageService {
  constructor(private pageRepository: PageRepository) {}

  async create(createPageDto: CreatePageDto) {
    await this.pageRepository.save(createPageDto);
  }

  async findById(pageId: string) {
    return this.pageRepository.findById(pageId);
  }

  async delete(pageId: string) {
    return this.pageRepository.softDelete(pageId);
  }

  async forceDelete(pageId: string) {
    return this.pageRepository.delete(pageId);
  }
}
