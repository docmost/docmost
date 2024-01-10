import api from '@/lib/api-client';
import { ICurrentUserResponse, IUser } from '@/features/user/types/user.types';

export async function getMe(): Promise<IUser> {
  const req = await api.get<IUser>('/user/me');
  return req.data as IUser;
}

export async function getUserInfo(): Promise<ICurrentUserResponse> {
  const req = await api.get<ICurrentUserResponse>('/user/info');
  return req.data as ICurrentUserResponse;
}

export async function updateUser(data: Partial<IUser>): Promise<IUser> {
  const req = await api.post<IUser>('/user/update', data);

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

