import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  JoinColumn,
  OneToOne,
  DeleteDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Page } from '../../page/entities/page.entity';
import { WorkspaceInvitation } from './workspace-invitation.entity';
import { Comment } from '../../comment/entities/comment.entity';
import { Space } from '../../space/entities/space.entity';
import { Group } from '../../group/entities/group.entity';
import { UserRole } from '../../../helpers/types/permission';

@Entity('workspaces')
export class Workspace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, nullable: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 255, nullable: true })
  logo: string;

  @Column({ length: 255, nullable: true, unique: true })
  hostname: string;

  @Column({ length: 255, nullable: true })
  customDomain: string;

  @Column({ type: 'boolean', default: true })
  enableInvite: boolean;

  @Column({ length: 255, unique: true, nullable: true })
  inviteCode: string;

  @Column({ type: 'jsonb', nullable: true })
  settings: any;

  @Column({ default: UserRole.MEMBER })
  defaultRole: string;

  @Column({ nullable: true, type: 'uuid' })
  creatorId: string;

  //@ManyToOne(() => User, (user) => user.workspaces)
  // @JoinColumn({ name: 'creatorId' })
  // creator: User;

  @Column({ nullable: true })
  defaultSpaceId: string;

  @OneToOne(() => Space, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'defaultSpaceId' })
  defaultSpace: Space;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  @OneToMany(() => User, (user) => user.workspace)
  users: [];

  @OneToMany(
    () => WorkspaceInvitation,
    (workspaceInvitation) => workspaceInvitation.workspace,
  )
  workspaceInvitations: WorkspaceInvitation[];

  @OneToMany(() => Page, (page) => page.workspace)
  pages: Page[];

  @OneToMany(() => Comment, (comment) => comment.workspace)
  comments: Comment[];

  @OneToMany(() => Space, (space) => space.workspace)
  spaces: [];

  @OneToMany(() => Group, (group) => group.workspace)
  groups: [];

  // workspaceUser?: WorkspaceUser;
}
