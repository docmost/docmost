import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GroupUser } from './group-user.entity';
import { Workspace } from '../../workspace/entities/workspace.entity';
import { User } from '../../user/entities/user.entity';
import { Unique } from 'typeorm';
import { SpaceMember } from '../../space/entities/space-member.entity';

@Entity('groups')
@Unique(['name', 'workspaceId'])
export class Group {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Column()
  workspaceId: string;

  @ManyToOne(() => Workspace, (workspace) => workspace.groups, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column({ nullable: true })
  creatorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'creatorId' })
  creator: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => GroupUser, (groupUser) => groupUser.group)
  groupUsers: GroupUser[];

  @OneToMany(() => SpaceMember, (spaceMembership) => spaceMembership.group)
  spaces: SpaceMember[];

  memberCount?: number;
}
