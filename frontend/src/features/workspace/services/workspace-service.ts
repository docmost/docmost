import api from '@/lib/api-client';
import { ICurrentUserResponse, IUser } from '@/features/user/types/user.types';
import { IWorkspace } from '../types/workspace.types';

export async function getWorkspace(): Promise<IWorkspace> {
  const req = await api.get<IWorkspace>('/workspace');
  return req.data as IWorkspace;
}

export async function getWorkspaceUsers(): Promise<IUser[]> {
  const req = await api.get<IUser[]>('/workspace/members');
  return req.data as IUser[];
}

export async function updateWorkspace(data: Partial<IWorkspace>) {
  const req = await api.post<IWorkspace>('/workspace/update', data);

  return req.data as IWorkspace;
}
