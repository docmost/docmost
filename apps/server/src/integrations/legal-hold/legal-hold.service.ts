import { Injectable } from '@nestjs/common';
import { Attachment } from '@docmost/db/types/entity.types';

export type PreservationReason = 'deleted' | 'edited';

export type PreservationContext = {
  workspaceId: string;
  actorId?: string | null;
};

export type ILegalHoldService = {
  preservePages(pageIds: string[], ctx: PreservationContext): Promise<void>;
  preserveSpace(spaceId: string, ctx: PreservationContext): Promise<void>;
  preserveComments(
    commentIds: string[],
    reason: PreservationReason,
    ctx: PreservationContext,
  ): Promise<void>;
  // returns ids of the given attachments that were preserved
  preserveAttachments(
    attachments: Attachment[],
    reason: PreservationReason,
    ctx: PreservationContext,
  ): Promise<string[]>;
  findPreservedAttachmentIds(attachmentIds: string[]): Promise<Set<string>>;
  preserveUser(userId: string, ctx: PreservationContext): Promise<void>;
  preserveAiChat(chatId: string, ctx: PreservationContext): Promise<void>;
  preserveBaseRows(
    pageId: string,
    rowIds: string[],
    ctx: PreservationContext,
  ): Promise<void>;
  preserveBaseProperty(
    pageId: string,
    propertyId: string,
    reason: PreservationReason,
    ctx: PreservationContext,
  ): Promise<void>;
};

export const LEGAL_HOLD_SERVICE = Symbol('LEGAL_HOLD_SERVICE');

@Injectable()
export class NoopLegalHoldService implements ILegalHoldService {
  async preservePages(
    _pageIds: string[],
    _ctx: PreservationContext,
  ): Promise<void> {}

  async preserveSpace(
    _spaceId: string,
    _ctx: PreservationContext,
  ): Promise<void> {}

  async preserveComments(
    _commentIds: string[],
    _reason: PreservationReason,
    _ctx: PreservationContext,
  ): Promise<void> {}

  async preserveAttachments(
    _attachments: Attachment[],
    _reason: PreservationReason,
    _ctx: PreservationContext,
  ): Promise<string[]> {
    return [];
  }

  async findPreservedAttachmentIds(
    _attachmentIds: string[],
  ): Promise<Set<string>> {
    return new Set();
  }

  async preserveUser(
    _userId: string,
    _ctx: PreservationContext,
  ): Promise<void> {}

  async preserveAiChat(
    _chatId: string,
    _ctx: PreservationContext,
  ): Promise<void> {}

  async preserveBaseRows(
    _pageId: string,
    _rowIds: string[],
    _ctx: PreservationContext,
  ): Promise<void> {}

  async preserveBaseProperty(
    _pageId: string,
    _propertyId: string,
    _reason: PreservationReason,
    _ctx: PreservationContext,
  ): Promise<void> {}
}
