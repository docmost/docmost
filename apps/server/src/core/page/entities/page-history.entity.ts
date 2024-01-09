import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Workspace } from '../../workspace/entities/workspace.entity';
import { Page } from './page.entity';
import { User } from '../../user/entities/user.entity';

@Entity('page_history')
export class PageHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  pageId: string;

  @ManyToOne(() => Page, (page) => page.pageHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pageId' })
  page: Page;

  @Column({ length: 500, nullable: true })
  title: string;

  @Column({ type: 'jsonb', nullable: true })
  content: string;

  @Column({ nullable: true })
  slug: string;

  @Column({ nullable: true })
  icon: string;

  @Column({ nullable: true })
  coverPhoto: string;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'uuid' })
  lastUpdatedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'lastUpdatedById' })
  lastUpdatedBy: User;

  @Column()
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
