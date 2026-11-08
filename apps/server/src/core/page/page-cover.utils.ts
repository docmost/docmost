import { Attachment } from '@docmost/db/types/entity.types';
import {
  COVER_FILE_PATTERN,
  COVER_PRESET_PATTERN,
} from './page-cover.constants';

export function isPresetCover(coverPhoto: string): boolean {
  return COVER_PRESET_PATTERN.test(coverPhoto);
}

export function getCoverAttachmentId(
  coverPhoto: string | null | undefined,
): string | null {
  return coverPhoto?.match(COVER_FILE_PATTERN)?.[1] ?? null;
}

export function buildCoverFileUrl(
  attachment: Pick<Attachment, 'id' | 'fileName'>,
): string {
  return `/api/files/${attachment.id}/${attachment.fileName}`;
}
