import { Injectable } from '@nestjs/common';
import { PageRepository } from './repositories/page.repository';
import { CreatePageDto } from './dto/create-page.dto';
import { Page } from './entities/page.entity';
import { UpdatePageDto } from './dto/update-page.dto';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class PageService {
  constructor(private pageRepository: PageRepository) {}

  async findById(pageId: string) {
    return this.pageRepository.findById(pageId);
  }

  async create(
    userId: string,
    workspaceId: string,
    createPageDto: CreatePageDto,
  ): Promise<Page> {
    const page = plainToInstance(Page, createPageDto);
    page.creatorId = userId;
    page.workspaceId = workspaceId;

    return await this.pageRepository.save(page);
  }

  async update(pageId: string, updatePageDto: UpdatePageDto): Promise<Page> {
    const existingPage = await this.pageRepository.findById(pageId);
    if (!existingPage) {
      throw new Error(`Page with ID ${pageId} not found`);
    }

    const page = await this.pageRepository.preload({
      id: pageId,
      ...updatePageDto,
    } as Page);
    return await this.pageRepository.save(page);
  }

  async updateState(pageId: string, content: any, ydoc: any): Promise<void> {
    await this.pageRepository.update(pageId, {
      content: content,
      ydoc: ydoc,
    });
  }

  async delete(pageId: string): Promise<void> {
    await this.pageRepository.softDelete(pageId);
  }

  async forceDelete(pageId: string): Promise<void> {
    await this.pageRepository.delete(pageId);
  }

  async lockOrUnlockPage(pageId: string, lock: boolean): Promise<Page> {
    await this.pageRepository.update(pageId, { isLocked: lock });
    return await this.pageRepository.findById(pageId);
  }

  async getRecentPages(limit = 10): Promise<Page[]> {
    return await this.pageRepository.find({
      order: {
        createdAt: 'DESC',
      },
      take: limit,
    });
  }
}
