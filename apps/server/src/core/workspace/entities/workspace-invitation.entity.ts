import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Workspace } from './workspace.entity';
import { User } from '../../user/entities/user.entity';

@Entity('workspace_invitations')
export class WorkspaceInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  workspaceId: string;

  @ManyToOne(() => Workspace, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column()
  invitedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'invitedById' })
  invitedBy: User;

  @Column({ length: 255 })
  email: string;

  @Column({ length: 100, nullable: true })
  role: string;

  @Column({ length: 100, nullable: true })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
