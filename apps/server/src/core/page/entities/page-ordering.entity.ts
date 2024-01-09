import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Workspace } from '../../workspace/entities/workspace.entity';

@Entity('page_ordering')
@Unique(['entityId', 'entityType'])
export class PageOrdering {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  entityId: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  entityType: string;

  @Column('uuid', { array: true })
  childrenIds: string[];

  @ManyToOne(() => Workspace, (workspace) => workspace.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column('uuid')
  workspaceId: string;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
