import { ColumnType } from 'kysely';
import { Generated, JsonValue } from './db';

type Timestamp = ColumnType<Date, Date | string, Date | string>;
export interface DocumentTasks {
  id: Generated<string>;
  workspaceId: string;
  pageId: string | null;
  creatorId: string | null;
  assigneeId: string | null;
  title: string;
  dueAt: Timestamp | null;
  status: Generated<'pending' | 'completed' | 'cancelled'>;
  completedAt: Timestamp | null;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
}
export interface ReadingBatches {
  id: Generated<string>;
  workspaceId: string;
  pageId: string | null;
  creatorId: string | null;
  title: string;
  status: Generated<'open' | 'closed' | 'revoked'>;
  createdAt: Generated<Timestamp>;
  closedAt: Timestamp | null;
}
export interface ReadingSnapshots {
  batchId: string;
  title: string;
  content: ColumnType<JsonValue, JsonValue, never>;
  textContent: string;
  contentHash: string;
  sourceUpdatedAt: Timestamp;
}
export interface ReadingRecipients {
  id: Generated<string>;
  batchId: string;
  userId: string | null;
  recipientName: string;
  confirmedAt: Timestamp | null;
}
export interface CollaborationOutbox {
  id: Generated<string>;
  workspaceId: string;
  userId: string;
  actorId: string;
  pageId: string;
  type: string;
  resourceId: string;
  createdAt: Generated<Timestamp>;
  deliveredAt: Timestamp | null;
}
