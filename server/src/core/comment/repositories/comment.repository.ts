import { DataSource, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { Comment } from '../entities/comment.entity';

@Injectable()
export class CommentRepository extends Repository<Comment> {
  constructor(private dataSource: DataSource) {
    super(Comment, dataSource.createEntityManager());
  }

  async findById(commentId: string) {
    return this.findOneBy({ id: commentId });
  }
}
