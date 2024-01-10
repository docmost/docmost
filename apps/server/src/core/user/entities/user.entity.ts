import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Workspace } from '../../workspace/entities/workspace.entity';
import { WorkspaceUser } from '../../workspace/entities/workspace-user.entity';
import { Page } from '../../page/entities/page.entity';
import { Comment } from '../../comment/entities/comment.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, nullable: true })
  name: string;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ nullable: true })
  emailVerifiedAt: Date;

  @Column()
  password: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ length: 100, nullable: true })
  locale: string;

  @Column({ length: 300, nullable: true })
  timezone: string;

  @Column({ type: 'jsonb', nullable: true })
  settings: any;

  @Column({ nullable: true })
  lastLoginAt: Date;

  @Column({ length: 100, nullable: true })
  lastLoginIp: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Workspace, (workspace) => workspace.creator)
  workspaces: Workspace[];

  @OneToMany(() => WorkspaceUser, (workspaceUser) => workspaceUser.user)
  workspaceUsers: WorkspaceUser[];

  @OneToMany(() => Page, (page) => page.creator)
  createdPages: Page[];

  @OneToMany(() => Comment, (comment) => comment.creator)
  comments: Comment[];

  toJSON() {
    delete this.password;
    return this;
  }

  @BeforeInsert()
  async hashPassword() {
    const saltRounds = 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
  }
}
