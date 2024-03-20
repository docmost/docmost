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
import { Space } from './space.entity';
import { Group } from '../../group/entities/group.entity';

@Entity('space_groups')
@Unique(['spaceId', 'groupId'])
export class SpaceGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  groupId: string;

  @ManyToOne(() => Group, (group) => group.spaces, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'groupId' })
  group: Group;

  @Column()
  spaceId: string;

  @ManyToOne(() => Space, (space) => space.spaceGroups, {
    onDelete: 'CASCADE',
  })
  space: Space;

  @Column({ length: 100, nullable: true })
  role: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
