import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Space } from './space.entity';

@Entity('space_users')
@Unique(['spaceId', 'userId'])
export class SpaceUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.spaceUsers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  spaceId: string;

  @ManyToOne(() => Space, (space) => space.spaceUsers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'spaceId' })
  space: Space;

  @Column({ length: 100, nullable: true })
  role: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
