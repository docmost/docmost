import api from "@/lib/api-client";
import { ICurrentUser, IUser } from "@/features/user/types/user.types";

export async function getMyInfo(): Promise<ICurrentUser> {
  const req = await api.post<ICurrentUser>("/users/me");
  const currentUser = req.data as ICurrentUser;
  if (!currentUser) return currentUser
  const user = currentUser.user
  const isAnonymous = user.id === "anonymous"
  return { ...currentUser, user: { ...user, isAnonymous } }
}

export async function updateUser(data: Partial<IUser>): Promise<IUser> {
  const req = await api.post<IUser>("/users/update", data);
  return req.data as IUser;
}

export async function uploadAvatar(file: File): Promise<any> {
  const formData = new FormData();
  formData.append("type", "avatar");
  formData.append("image", file);

  const req = await api.post("/attachments/upload-image", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return req;
}
