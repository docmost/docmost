import api from '@/lib/api-client';
import {
  IAddSpaceMember,
  IChangeSpaceMemberRole,
  IRemoveSpaceMember,
  ISpace,
} from '@/features/space/types/space.types';
import { IPagination } from '@/lib/types.ts';
import { IUser } from '@/features/user/types/user.types.ts';

export async function getSpaces(): Promise<IPagination<ISpace>> {
  const req = await api.post('/spaces');
  return req.data;
}

export async function getSpaceById(spaceId: string): Promise<ISpace> {
  const req = await api.post<ISpace>('/spaces/info', { spaceId });
  return req.data;
}

export async function createSpace(data: Partial<ISpace>): Promise<ISpace> {
  const req = await api.post<ISpace>('/spaces/create', data);
  return req.data;
}

export async function updateSpace(data: Partial<ISpace>): Promise<ISpace> {
  const req = await api.post<ISpace>('/spaces/update', data);
  return req.data;
}

export async function deleteSpace(spaceId: string): Promise<void> {
  await api.post<void>('/spaces/delete', { spaceId });
}

export async function getSpaceMembers(
  spaceId: string
): Promise<IPagination<IUser>> {
  const req = await api.post<any>('/spaces/members', { spaceId });
  return req.data;
}

export async function addSpaceMember(data: IAddSpaceMember): Promise<void> {
  await api.post('/spaces/members/add', data);
}

export async function removeSpaceMember(
  data: IRemoveSpaceMember
): Promise<void> {
  await api.post('/spaces/members/remove', data);
}

export async function changeMemberRole(
  data: IChangeSpaceMemberRole
): Promise<void> {
  await api.post('/spaces/members/change-role', data);
}
