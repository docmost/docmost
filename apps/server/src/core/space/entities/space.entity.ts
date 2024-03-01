import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Workspace } from '../../workspace/entities/workspace.entity';
import { SpaceUser } from './space-user.entity';
import { Page } from '../../page/entities/page.entity';

@Entity('spaces')
export class Space {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, nullable: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 255, nullable: true })
  icon: string;

  @Column({ length: 255, nullable: true, unique: true })
  hostname: string;

  @Column()
  creatorId: string;

  @ManyToOne(() => User, (user) => user.spaces)
  @JoinColumn({ name: 'creatorId' })
  creator: User;

  @Column()
  workspaceId: string;

  @ManyToOne(() => Workspace, (workspace) => workspace.spaces, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @OneToMany(() => SpaceUser, (workspaceUser) => workspaceUser.space)
  spaceUsers: SpaceUser[];

  @OneToMany(() => Page, (page) => page.space)
  pages: Page[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
