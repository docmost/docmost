import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { WorkspaceUser } from './workspace-user.entity';
import { Page } from '../../page/entities/page.entity';
import { WorkspaceInvitation } from './workspace-invitation.entity';

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

  @Column()
  creatorId: string;

  @ManyToOne(() => User, (user) => user.workspaces)
  @JoinColumn({ name: 'creatorId' })
  creator: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => WorkspaceUser, (workspaceUser) => workspaceUser.workspace)
  workspaceUsers: WorkspaceUser[];

  @OneToMany(
    () => WorkspaceInvitation,
    (workspaceInvitation) => workspaceInvitation.workspace,
  )
  workspaceInvitations: WorkspaceInvitation[];

  @OneToMany(() => Page, (page) => page.workspace)
  pages: Page[];
}
