import { DataSource, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { Attachment } from '../entities/attachment.entity';

@Injectable()
export class AttachmentRepository extends Repository<Attachment> {
  constructor(private dataSource: DataSource) {
    super(Attachment, dataSource.createEntityManager());
  }

  async findById(id: string) {
    return this.findOneBy({ id: id });
  }
}
