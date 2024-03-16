import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Workspace } from '../../workspace/entities/workspace.entity';
import { SpaceUser } from './space-user.entity';
import { Page } from '../../page/entities/page.entity';
import { SpacePrivacy, SpaceRole } from '../../../helpers/types/permission';

@Entity('spaces')
@Unique(['slug', 'workspaceId'])
export class Space {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, nullable: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  slug: string;

  @Column({ length: 255, nullable: true })
  icon: string;

  @Column({ length: 100, default: SpacePrivacy.OPEN })
  privacy: string;

  @Column({ length: 100, default: SpaceRole.WRITER })
  defaultRole: string;

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

  @OneToMany(() => SpaceUser, (spaceUser) => spaceUser.space)
  spaceUsers: SpaceUser[];

  @OneToMany(() => Page, (page) => page.space)
  pages: Page[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
