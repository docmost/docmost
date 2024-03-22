import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Check,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Space } from './space.entity';
import { Group } from '../../group/entities/group.entity';

@Entity('space_members')
// allow either userId or groupId
@Check(
  'CHK_allow_userId_or_groupId',
  `("userId" IS NOT NULL AND "groupId" IS NULL) OR ("userId" IS NULL AND "groupId" IS NOT NULL)`,
)
@Unique(['spaceId', 'userId'])
@Unique(['spaceId', 'groupId'])
export class SpaceMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId: string;

  @ManyToOne(() => User, (user) => user.spaces, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  groupId: string;

  @ManyToOne(() => Group, (group) => group.spaces, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'groupId' })
  group: Group;

  @Column()
  spaceId: string;

  @ManyToOne(() => Space, (space) => space.spaceMembers, {
    onDelete: 'CASCADE',
  })
  space: Space;

  @Column({ length: 100 })
  role: string;

  @Column({ nullable: true })
  creatorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'creatorId' })
  creator: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
