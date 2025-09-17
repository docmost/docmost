import api from "@/lib/api-client";
import {
  AvatarIconType,
  IAttachment,
} from "@/features/attachments/types/attachment.types.ts";

export async function uploadIcon(
  file: File,
  type: AvatarIconType,
  spaceId?: string,
): Promise<IAttachment> {
  const formData = new FormData();
  formData.append("type", type);
  if (spaceId) {
    formData.append("spaceId", spaceId);
  }
  formData.append("image", file);

  return await api.post("/attachments/upload-image", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
}

export async function uploadUserAvatar(file: File): Promise<IAttachment> {
  return uploadIcon(file, AvatarIconType.AVATAR);
}

export async function uploadSpaceIcon(
  file: File,
  spaceId: string,
): Promise<IAttachment> {
  return uploadIcon(file, AvatarIconType.SPACE_ICON, spaceId);
}

export async function uploadWorkspaceIcon(file: File): Promise<IAttachment> {
  return uploadIcon(file, AvatarIconType.WORKSPACE_ICON);
}

async function removeIcon(
  type: AvatarIconType,
  spaceId?: string,
): Promise<void> {
  const payload: { spaceId?: string; type: string } = { type };

  if (spaceId) {
    payload.spaceId = spaceId;
  }

  await api.post("/attachments/remove-icon", payload);
}

export async function removeAvatar(): Promise<void> {
  await removeIcon(AvatarIconType.AVATAR);
}

export async function removeSpaceIcon(spaceId: string): Promise<void> {
  await removeIcon(AvatarIconType.SPACE_ICON, spaceId);
}

export async function removeWorkspaceIcon(): Promise<void> {
  await removeIcon(AvatarIconType.WORKSPACE_ICON);
}
