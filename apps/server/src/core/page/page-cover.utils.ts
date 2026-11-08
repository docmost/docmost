import { Attachment } from '@docmost/db/types/entity.types';
import {
  COVER_FILE_PATTERN,
  COVER_PRESET_PATTERN,
  COVER_UNSPLASH_PATTERN,
} from './page-cover.constants';
import { ICopyPageAttachment } from './dto/duplicate-page.dto';

export function isPresetCover(coverPhoto: string): boolean {
  return COVER_PRESET_PATTERN.test(coverPhoto);
}

export function getCoverAttachmentId(
  coverPhoto: string | null | undefined,
): string | null {
  return coverPhoto?.match(COVER_FILE_PATTERN)?.[1] ?? null;
}

export function getUnsplashPhotoId(
  coverPhoto: string | null | undefined,
): string | null {
  return coverPhoto?.match(COVER_UNSPLASH_PATTERN)?.[1] ?? null;
}

export function buildCoverFileUrl(
  attachment: Pick<Attachment, 'id' | 'fileName'>,
): string {
  return `/api/files/${attachment.id}/${attachment.fileName}`;
}

export function remapCopiedCover(
  coverPhoto: string | null,
  pages: { oldPageId: string; newPageId: string },
  attachmentMap: Map<string, ICopyPageAttachment>,
  generateId: () => string,
): string | null {
  const attachmentId = getCoverAttachmentId(coverPhoto);
  if (!attachmentId) return coverPhoto;

  const newAttachmentId =
    attachmentMap.get(attachmentId)?.newAttachmentId ?? generateId();
  // a cover file always belongs to its page, so that page owns the copy
  attachmentMap.set(attachmentId, {
    oldAttachmentId: attachmentId,
    newAttachmentId,
    ...pages,
  });

  return coverPhoto.replace(attachmentId, newAttachmentId);
}
