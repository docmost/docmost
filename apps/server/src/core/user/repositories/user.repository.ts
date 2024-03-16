import { DataSource, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserRepository extends Repository<User> {
  constructor(private dataSource: DataSource) {
    super(User, dataSource.createEntityManager());
  }
  async findByEmail(email: string): Promise<User> {
    const queryBuilder = this.dataSource.createQueryBuilder(User, 'user');
    return await queryBuilder.where('user.email = :email', { email }).getOne();
  }

  async findById(userId: string): Promise<User> {
    const queryBuilder = this.dataSource.createQueryBuilder(User, 'user');
    return await queryBuilder.where('user.id = :id', { id: userId }).getOne();
  }

  async findOneByEmail(email: string, workspaceId: string): Promise<User> {
    const queryBuilder = this.dataSource.createQueryBuilder(User, 'user');
    return await queryBuilder
      .where('user.email = :email', { email })
      .andWhere('user.workspaceId = :workspaceId', { workspaceId })
      .getOne();
  }

  async findOneByIdx(userId: string, workspaceId: string): Promise<User> {
    const queryBuilder = this.dataSource.createQueryBuilder(User, 'user');
    return await queryBuilder
      .where('user.id = :id', { id: userId })
      .andWhere('user.workspaceId = :workspaceId', { workspaceId })
      .getOne();
  }
}
