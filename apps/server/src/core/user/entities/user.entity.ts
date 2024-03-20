import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Workspace } from '../../workspace/entities/workspace.entity';
import { Page } from '../../page/entities/page.entity';
import { Comment } from '../../comment/entities/comment.entity';
import { Space } from '../../space/entities/space.entity';
import { SpaceUser } from '../../space/entities/space-user.entity';

@Entity('users')
@Unique(['email', 'workspaceId'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, nullable: true })
  name: string;

  @Column({ length: 255 })
  email: string;

  @Column({ nullable: true })
  emailVerifiedAt: Date;

  @Column()
  password: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ nullable: true, length: 100 })
  role: string;

  @Column({ nullable: true })
  workspaceId: string;

  @ManyToOne(() => Workspace, (workspace) => workspace.users, {
    onDelete: 'CASCADE',
  })
  workspace: Workspace;

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

  @OneToMany(() => Page, (page) => page.creator)
  createdPages: Page[];

  @OneToMany(() => Comment, (comment) => comment.creator)
  comments: Comment[];

  @OneToMany(() => Space, (space) => space.creator)
  createdSpaces: Space[];

  @OneToMany(() => SpaceUser, (spaceUser) => spaceUser.user)
  spaces: SpaceUser[];

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
