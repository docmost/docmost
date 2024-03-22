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
import { Page } from '../../page/entities/page.entity';
import { SpaceVisibility, SpaceRole } from '../../../helpers/types/permission';
import { SpaceMember } from './space-member.entity';

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

  @Column({ length: 100, default: SpaceVisibility.OPEN })
  visibility: string;

  @Column({ length: 100, default: SpaceRole.WRITER })
  defaultRole: string;

  @Column({ nullable: true })
  creatorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'creatorId' })
  creator: User;

  @Column()
  workspaceId: string;

  @ManyToOne(() => Workspace, (workspace) => workspace.spaces, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @OneToMany(() => SpaceMember, (spaceMember) => spaceMember.space)
  spaceMembers: SpaceMember[];

  @OneToMany(() => Page, (page) => page.space)
  pages: Page[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
