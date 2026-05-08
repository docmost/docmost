import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { ChatService } from './services/chat.service';
import { MinimaxService } from './services/minimax.service';
import {
  CreateChatDto,
  ChatListDto,
  ChatInfoDto,
  DeleteChatDto,
  UpdateChatTitleDto,
  SearchChatsDto,
  SendMessageDto,
} from './dto/chat.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import type { User, Workspace } from '@docmost/db/types/entity.types';

@UseGuards(JwtAuthGuard)
@Controller('ai/chats')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly minimaxService: MinimaxService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async createChat(
    @Body() _dto: CreateChatDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.chatService.createChat(user.id, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  async listChats(
    @Body() dto: ChatListDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.chatService.listChats(
      user.id,
      workspace.id,
      dto.limit || 30,
      dto.cursor,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  async getChatInfo(@Body() dto: ChatInfoDto) {
    return this.chatService.getChatInfo(dto.chatId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async deleteChat(@Body() dto: DeleteChatDto) {
    await this.chatService.deleteChat(dto.chatId);
    return { ok: true };
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async updateChatTitle(
    @Body() dto: UpdateChatTitleDto,
  ) {
    return this.chatService.updateChatTitle(dto.chatId, dto.title);
  }

  @HttpCode(HttpStatus.OK)
  @Post('search')
  async searchChats(
    @Body() dto: SearchChatsDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.chatService.searchChats(dto.query, user.id, workspace.id);
  }

  @Post('send')
  async sendMessage(
    @Body() dto: SendMessageDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Res() res: FastifyReply,
    @Req() req: FastifyRequest,
  ) {
    let chatId = dto.chatId;

    if (!chatId) {
      const chat = await this.chatService.createChat(user.id, workspace.id);
      chatId = chat.id;
    }

    const abortController = new AbortController();

    req.raw.on('close', () => {
      abortController.abort();
    });

    res.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    res.raw.write(`data: ${JSON.stringify({ type: 'chat_created', chatId })}\n\n`);

    await this.chatService.saveMessage(chatId, workspace.id, user.id, 'user', dto.content);

    const history = await this.chatService.getChatHistory(chatId);
    const messages = [
      { role: 'system' as const, content: 'You are a helpful assistant for Docmost, a documentation and wiki platform.' },
      ...history,
    ];

    let fullResponse = '';
    let wroteContent = false;

    await this.minimaxService.chatStream(
      messages,
      (text) => {
        fullResponse += text;
        wroteContent = true;
        res.raw.write(`data: ${JSON.stringify({ type: 'content', text })}\n\n`);
      },
      async () => {
        if (!wroteContent) {
          fullResponse = 'I have no answer for that.';
          res.raw.write(`data: ${JSON.stringify({ type: 'content', text: fullResponse })}\n\n`);
        }

        const messageId = await this.chatService.saveMessage(
          chatId, workspace.id, user.id, 'assistant', fullResponse,
        );

        await this.chatService.updateChatTimestamp(chatId);

        res.raw.write(`data: ${JSON.stringify({ type: 'done', messageId })}\n\n`);
        res.raw.write('data: [DONE]\n\n');
        res.raw.end();
      },
      (err) => {
        res.raw.write(`data: ${JSON.stringify({ type: 'error', message: err })}\n\n`);
        res.raw.write('data: [DONE]\n\n');
        res.raw.end();
      },
      abortController.signal,
    );
  }
}
