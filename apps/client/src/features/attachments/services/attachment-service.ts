import api from "@/lib/api-client";
import loadImage from "blueimp-load-image";
import {
  AvatarIconType,
  IAttachment,
} from "@/features/attachments/types/attachment.types.ts";

async function compressAndResizeIcon(
  file: File,
  type: AvatarIconType,
): Promise<File> {
  const isPng = file.type === "image/png";

  const { image: canvas } = await loadImage(file, {
    maxWidth: 300,
    maxHeight: 300,
    canvas: true,
    orientation: true,
    imageSmoothingQuality: "high",
  });

  if (type === AvatarIconType.AVATAR || !isPng) {
    const ctx = (canvas as HTMLCanvasElement).getContext("2d")!;
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";
  }

  const outputType = isPng ? "image/png" : "image/jpeg";

  return new Promise<File>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to compress image"));
          return;
        }
        resolve(new File([blob], file.name, { type: outputType }));
      },
      outputType,
      isPng ? undefined : 0.85,
    );
  });
}

export async function uploadIcon(
  file: File,
  type: AvatarIconType,
  spaceId?: string,
): Promise<IAttachment> {
  const processed = await compressAndResizeIcon(file, type);

  const formData = new FormData();
  formData.append("type", type);
  if (spaceId) {
    formData.append("spaceId", spaceId);
  }
  formData.append("image", processed);

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
