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

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  emailVerifiedAt: Date;

  @Column()
  password: string;

  @Column({ nullable: true })
  avatar_url: string;

  @Column({ nullable: true })
  locale: string;

  @Column({ nullable: true })
  timezone: string;

  @Column({ type: 'jsonb', nullable: true })
  settings: any;

  @Column({ nullable: true })
  lastLoginAt: Date;

  @Column({ nullable: true })
  lastLoginIp: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Workspace, (workspace) => workspace.creator, {
    createForeignKeyConstraints: false,
  })
  workspaces: Workspace[];

  @OneToMany(() => WorkspaceUser, (workspaceUser) => workspaceUser.user, {
    createForeignKeyConstraints: false,
  })
  workspaceUser: WorkspaceUser[];

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
