import { DataSource, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserRepository extends Repository<User> {
  constructor(private dataSource: DataSource) {
    super(User, dataSource.createEntityManager());
  }
  async findByEmail(email: string) {
    return this.findOneBy({ email: email });
  }

  async findById(userId: string) {
    return this.findOneBy({ id: userId });
  }
}
