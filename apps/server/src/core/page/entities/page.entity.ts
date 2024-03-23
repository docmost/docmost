import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Workspace } from '../../workspace/entities/workspace.entity';
import { Comment } from '../../comment/entities/comment.entity';
import { PageHistory } from './page-history.entity';
import { Space } from '../../space/entities/space.entity';

@Entity('pages')
@Index(['tsv'])
export class Page {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 500, nullable: true })
  title: string;

  @Column({ nullable: true })
  icon: string;

  @Column({ type: 'jsonb', nullable: true })
  content: string;

  @Column({ type: 'text', nullable: true })
  html: string;

  @Column({ type: 'text', nullable: true })
  textContent: string;

  @Column({
    type: 'tsvector',
    select: false,
    nullable: true,
  })
  tsv: string;

  @Column({ type: 'bytea', nullable: true })
  ydoc: any;

  @Column({ nullable: true })
  slug: string;

  @Column({ nullable: true })
  coverPhoto: string;

  @Column({ length: 255, nullable: true })
  editor: string;

  @Column({ length: 255, nullable: true })
  shareId: string;

  @Column({ type: 'uuid', nullable: true })
  parentPageId: string;

  @Column()
  creatorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'creatorId' })
  creator: User;

  @Column({ type: 'uuid', nullable: true })
  lastUpdatedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'lastUpdatedById' })
  lastUpdatedBy: User;

  @Column({ type: 'uuid', nullable: true })
  deletedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'deletedById' })
  deletedBy: User;

  @Column()
  spaceId: string;

  @ManyToOne(() => Space, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'spaceId' })
  space: Space;

  @Column()
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column({ type: 'boolean', default: false })
  isLocked: boolean;

  @Column({ length: 255, nullable: true })
  status: string;

  @Column({ type: 'date', nullable: true })
  publishedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date;

  @ManyToOne(() => Page, (page) => page.childPages)
  @JoinColumn({ name: 'parentPageId' })
  parentPage: Page;

  @OneToMany(() => Page, (page) => page.parentPage, { onDelete: 'CASCADE' })
  childPages: Page[];

  @OneToMany(() => PageHistory, (pageHistory) => pageHistory.page)
  pageHistory: PageHistory[];

  @OneToMany(() => Comment, (comment) => comment.page)
  comments: Comment[];
}
