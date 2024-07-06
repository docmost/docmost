import { User, Workspace } from '@docmost/db/types/entity.types';
import { FastifyRequest } from 'fastify';

export interface AppRequest extends FastifyRequest {
  user: User;
  raw: FastifyRequest['raw'] & {
    workspaceId: string;
    workspace: Workspace;
  };
}
