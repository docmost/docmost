import { Queue } from 'bullmq';
import { Attachment } from '@docmost/db/types/entity.types';
import {
  COVER_CLEANUP_DELAY_MS,
  COVER_CLEANUP_JOB_PREFIX,
  COVER_FILE_PATTERN,
  COVER_PRESET_PATTERN,
  COVER_UNSPLASH_PREFIX,
} from './page-cover.constants';
import { QueueJob } from '../../integrations/queue/constants';
import { UNSPLASH_PHOTO_ID_PATTERN } from '../../integrations/unsplash/unsplash.constants';
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
  if (!coverPhoto?.startsWith(COVER_UNSPLASH_PREFIX)) return null;
  const photoId = coverPhoto.slice(COVER_UNSPLASH_PREFIX.length);
  return UNSPLASH_PHOTO_ID_PATTERN.test(photoId) ? photoId : null;
}

// one job per file, so the hour restarts each time the upload stops being the cover
export async function queueCoverCleanup(
  queue: Queue,
  job: { pageId: string; attachmentId: string },
): Promise<void> {
  const jobId = `${COVER_CLEANUP_JOB_PREFIX}${job.attachmentId}`;
  await queue.remove(jobId);
  await queue.add(QueueJob.DELETE_UNUSED_COVER, job, {
    jobId,
    delay: COVER_CLEANUP_DELAY_MS,
    removeOnComplete: true,
    removeOnFail: true,
  });
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
