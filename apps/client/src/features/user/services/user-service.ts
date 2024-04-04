import api from '@/lib/api-client';
import { ICurrentUser, IUser } from '@/features/user/types/user.types';

export async function getMe(): Promise<IUser> {
  const req = await api.post<IUser>('/users/me');
  return req.data as IUser;
}

export async function getUserInfo(): Promise<ICurrentUser> {
  const req = await api.post<ICurrentUser>('/users/info');
  return req.data as ICurrentUser;
}

export async function updateUser(data: Partial<IUser>): Promise<IUser> {
  const req = await api.post<IUser>('/users/update', data);
  return req.data as IUser;
}

export async function uploadAvatar(file: File) {
  const formData = new FormData();
  formData.append('avatar', file);
  const req = await api.post('/attachments/upload/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    }
  });
  return req.data;
}

