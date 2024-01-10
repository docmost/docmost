import api from '@/lib/api-client';
import { IComment, IResolveComment } from '@/features/comment/types/comment.types';

export async function createComment(data: Partial<IComment>): Promise<IComment> {
  const req = await api.post<IComment>('/comments/create', data);
  return req.data as IComment;
}

export async function resolveComment(data: IResolveComment): Promise<IComment> {
  const req = await api.post<IComment>(`/comments/resolve`, data);
  return req.data as IComment;
}

export async function updateComment(data: Partial<IComment>): Promise<IComment> {
  const req = await api.post<IComment>(`/comments/update`, data);
  return req.data as IComment;
}

export async function getCommentById(id: string): Promise<IComment> {
  const req = await api.post<IComment>('/comments/view', { id });
  return req.data as IComment;
}

export async function getPageComments(pageId: string): Promise<IComment[]> {
  const req = await api.post<IComment[]>('/comments', { pageId });
  return req.data as IComment[];
}

export async function deleteComment(id: string): Promise<void> {
  await api.post('/comments/delete', { id });
}
