import { FastifyReply } from 'fastify';
import { addDays } from 'date-fns';
import { validate as isValidUUID } from 'uuid';
import { EnvironmentService } from '../../integrations/environment/environment.service';

export const JOINED_WORKSPACES_COOKIE = 'joinedWorkspaces';
export const JOINED_WORKSPACES_LIMIT = 15;

export function parseJoinedWorkspaceIds(cookie: string | undefined): string[] {
  try {
    const ids = JSON.parse(cookie);
    return Array.isArray(ids) ? ids.filter((id) => isValidUUID(id)) : [];
  } catch {
    return [];
  }
}

export function moveJoinedWorkspaceToFront(
  workspaceIds: string[],
  workspaceId: string,
): string[] {
  return [workspaceId, ...workspaceIds.filter((id) => id !== workspaceId)].slice(
    0,
    JOINED_WORKSPACES_LIMIT,
  );
}

export function writeJoinedWorkspacesCookie(
  res: FastifyReply,
  workspaceIds: string[],
  environmentService: EnvironmentService,
) {
  res.setCookie(JOINED_WORKSPACES_COOKIE, JSON.stringify(workspaceIds), {
    httpOnly: false,
    sameSite: 'lax',
    domain: '.' + environmentService.getSubdomainHost(),
    path: '/',
    expires: addDays(new Date(), 365),
    secure: environmentService.isHttps(),
  });
}
