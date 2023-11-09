import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  OneToMany,
  DeleteDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Page } from '../../page/entities/page.entity';
import { Workspace } from '../../workspace/entities/workspace.entity';

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'jsonb', nullable: true })
  content: any;

  @Column({ type: 'varchar', length: 255, nullable: true })
  selection: string;

  @Column({ type: 'varchar', length: 55, nullable: true })
  type: string;

  @Column()
  creatorId: string;

  @ManyToOne(() => User, (user) => user.comments)
  @JoinColumn({ name: 'creatorId' })
  creator: User;

  @Column()
  pageId: string;

  @ManyToOne(() => Page, (page) => page.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pageId' })
  page: Page;

  @Column({ type: 'uuid', nullable: true })
  parentCommentId: string;

  @ManyToOne(() => Comment, (comment) => comment.replies, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parentCommentId' })
  parentComment: Comment;

  @OneToMany(() => Comment, (comment) => comment.parentComment)
  replies: Comment[];

  @Column({ nullable: true })
  resolvedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'resolvedById' })
  resolvedBy: User;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @Column()
  workspaceId: string;

  @ManyToOne(() => Workspace, (workspace) => workspace.comments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  editedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date;
}
