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

@Entity('workspaces')
export class Workspace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ nullable: true })
  logo?: string;

  @Column({ unique: true })
  hostname: string;

  @Column({ nullable: true })
  customDomain?: string;

  @Column({ type: 'boolean', default: true })
  enableInvite: boolean;

  @Column({ type: 'text', unique: true, nullable: true })
  inviteCode?: string;

  @Column({ type: 'jsonb', nullable: true })
  settings?: any;

  @ManyToOne(() => User, (user) => user.workspaces, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'creatorId' })
  creator: User;

  @Column()
  creatorId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => WorkspaceUser, (workspaceUser) => workspaceUser.workspace, {
    createForeignKeyConstraints: false,
  })
  workspaceUser: WorkspaceUser[];
}
