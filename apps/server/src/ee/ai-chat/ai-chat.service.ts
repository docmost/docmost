import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AiChatRepo } from './ai-chat.repo';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { User } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { FastifyReply } from 'fastify';
import { AttachmentRepo } from '@docmost/db/repos/attachment/attachment.repo';
import { StorageService } from '../../integrations/storage/storage.service';
import {
  getAttachmentFolderPath,
  prepareFile,
} from '../../core/attachment/attachment.utils';
import { AttachmentType } from '../../core/attachment/attachment.constants';
import { createByteCountingStream } from '../../common/helpers/utils';
import { v7 as uuid7 } from 'uuid';
import { MultipartFile } from '@fastify/multipart';

@Injectable()
export class AiChatService {
  constructor(
    private readonly aiChatRepo: AiChatRepo,
    private readonly workspaceRepo: WorkspaceRepo,
    private readonly attachmentRepo: AttachmentRepo,
    private readonly storageService: StorageService,
  ) {}

  private async assertAiChatEnabled(workspaceId: string) {
    const workspace = await this.workspaceRepo.findById(workspaceId);
    const settings = (workspace?.settings ?? {}) as Record<string, any>;
    if (!settings?.ai?.chatEnabled) {
      throw new ForbiddenException('AI chat is not enabled');
    }
  }

  private mapChat(chat: any) {
    return {
      ...chat,
      createdAt: chat.createdAt?.toISOString?.() ?? chat.createdAt,
      updatedAt: chat.updatedAt?.toISOString?.() ?? chat.updatedAt,
    };
  }

  private mapMessage(msg: any) {
    return {
      id: msg.id,
      chatId: msg.chatId,
      role: msg.role,
      content: msg.content,
      toolCalls: msg.toolCalls,
      metadata: msg.metadata,
      createdAt: msg.createdAt?.toISOString?.() ?? msg.createdAt,
    };
  }

  async createChat(user: User, workspaceId: string) {
    await this.assertAiChatEnabled(workspaceId);
    const chat = await this.aiChatRepo.createChat(workspaceId, user.id);
    return this.mapChat(chat);
  }

  async listChats(
    user: User,
    workspaceId: string,
    pagination: PaginationOptions,
  ) {
    await this.assertAiChatEnabled(workspaceId);
    const result = await this.aiChatRepo.listChats(
      workspaceId,
      user.id,
      pagination,
    );
    return { ...result, items: result.items.map((c) => this.mapChat(c)) };
  }

  async getChatInfo(chatId: string, user: User, workspaceId: string) {
    await this.assertAiChatEnabled(workspaceId);
    const chat = await this.aiChatRepo.findById(chatId, workspaceId, user.id);
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }
    const messages = await this.aiChatRepo.getMessages(chatId);
    return {
      chat: this.mapChat(chat),
      messages: messages.map((m) => this.mapMessage(m)),
    };
  }

  async deleteChat(chatId: string, user: User, workspaceId: string) {
    await this.assertAiChatEnabled(workspaceId);
    const chat = await this.aiChatRepo.findById(chatId, workspaceId, user.id);
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }
    await this.aiChatRepo.softDelete(chatId);
  }

  async updateTitle(
    chatId: string,
    title: string,
    user: User,
    workspaceId: string,
  ) {
    await this.assertAiChatEnabled(workspaceId);
    const chat = await this.aiChatRepo.findById(chatId, workspaceId, user.id);
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }
    await this.aiChatRepo.updateTitle(chatId, title);
  }

  async searchChats(query: string, user: User, workspaceId: string) {
    await this.assertAiChatEnabled(workspaceId);
    const chats = await this.aiChatRepo.searchChats(
      workspaceId,
      user.id,
      query,
    );
    return chats.map((c) => this.mapChat(c));
  }

  async sendMessage(
    data: {
      chatId?: string;
      content: string;
    },
    user: User,
    workspaceId: string,
    res: FastifyReply,
  ) {
    await this.assertAiChatEnabled(workspaceId);

    let chatId = data.chatId;
    if (!chatId) {
      const chat = await this.aiChatRepo.createChat(workspaceId, user.id);
      chatId = chat.id;
      res.raw.write(
        `data: ${JSON.stringify({ type: 'chat_created', chatId })}\n\n`,
      );
    } else {
      const chat = await this.aiChatRepo.findById(
        chatId,
        workspaceId,
        user.id,
      );
      if (!chat) {
        throw new NotFoundException('Chat not found');
      }
    }

    await this.aiChatRepo.insertMessage({
      chatId,
      workspaceId,
      userId: user.id,
      role: 'user',
      content: data.content,
    });

    const assistantText =
      'AI chat is enabled but no LLM provider is configured. Configure your AI settings in workspace settings.';

    const assistantMsg = await this.aiChatRepo.insertMessage({
      chatId,
      workspaceId,
      role: 'assistant',
      content: assistantText,
    });

    await this.aiChatRepo.touchChat(chatId);

    if (!data.chatId) {
      await this.aiChatRepo.updateTitle(
        chatId,
        data.content.slice(0, 80) || 'New chat',
      );
    }

    res.raw.write(
      `data: ${JSON.stringify({ type: 'content', text: assistantText })}\n\n`,
    );
    res.raw.write(
      `data: ${JSON.stringify({ type: 'done', messageId: assistantMsg.id })}\n\n`,
    );
    res.raw.write('data: [DONE]\n\n');
  }

  async uploadFile(
    file: MultipartFile,
    user: User,
    workspaceId: string,
    chatId?: string,
  ) {
    await this.assertAiChatEnabled(workspaceId);
    const prepared = await prepareFile(Promise.resolve(file), {
      skipBuffer: true,
    });
    const attachmentId = uuid7();
    const filePath = `${getAttachmentFolderPath(AttachmentType.Chat, workspaceId)}/${attachmentId}/${prepared.fileName}`;
    const { stream, getBytesRead } = createByteCountingStream(
      prepared.multiPartFile.file,
    );
    await this.storageService.upload(filePath, stream);
    prepared.fileSize = getBytesRead();

    await this.attachmentRepo.insertAttachment({
      id: attachmentId,
      type: AttachmentType.Chat,
      filePath,
      fileName: prepared.fileName,
      fileSize: prepared.fileSize,
      mimeType: prepared.mimeType,
      fileExt: prepared.fileExtension,
      creatorId: user.id,
      workspaceId,
      aiChatId: chatId ?? null,
    });

    if (chatId) {
      await this.attachmentRepo.claimAttachmentsForChat(
        [attachmentId],
        chatId,
        user.id,
        workspaceId,
      );
    }

    return {
      id: attachmentId,
      fileName: prepared.fileName,
      fileExt: prepared.fileExtension,
      fileSize: prepared.fileSize,
      mimeType: prepared.mimeType,
    };
  }
}
