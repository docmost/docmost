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
import { Workspace } from './workspace.entity';
import { User } from '../../user/entities/user.entity';

@Entity('workspace_users')
@Unique(['workspaceId', 'userId'])
export class WorkspaceUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.workspaceUser, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Workspace, (workspace) => workspace.workspaceUser, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column()
  workspaceId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  role?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
