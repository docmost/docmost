import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { AiService } from './ai.service';
import { AiGenerateDto } from './dto/ai-generate.dto';
import { AI_ACTION_IDS } from './prompts';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { Workspace } from '@docmost/db/types/entity.types';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(private readonly aiService: AiService) {}

  @HttpCode(HttpStatus.OK)
  @Get('config')
  config(@AuthWorkspace() workspace: Workspace) {
    return {
      configured: this.aiService.isConfigured() && this.isEnabled(workspace),
      availableActions: AI_ACTION_IDS,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('generate')
  async generate(
    @Body() dto: AiGenerateDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertEnabled(workspace);
    return this.aiService.generate(dto.action, dto.content, dto.prompt);
  }

  @SkipTransform()
  @Post('generate/stream')
  async generateStream(
    @Body() dto: AiGenerateDto,
    @AuthWorkspace() workspace: Workspace,
    @Res() reply: FastifyReply,
  ) {
    this.assertEnabled(workspace);

    reply.raw.setHeader('content-type', 'text/event-stream');
    reply.raw.setHeader('cache-control', 'no-cache, no-transform');
    reply.raw.setHeader('connection', 'keep-alive');
    reply.hijack();

    try {
      const stream = this.aiService.streamGenerate(
        dto.action,
        dto.content,
        dto.prompt,
      );
      for await (const delta of stream) {
        reply.raw.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
      reply.raw.write('data: [DONE]\n\n');
    } catch (err) {
      this.logger.error(`AI generate stream failed: ${(err as Error)?.message}`);
      reply.raw.write(
        `data: ${JSON.stringify({ error: (err as Error)?.message ?? 'AI error' })}\n\n`,
      );
    } finally {
      reply.raw.end();
    }
  }

  private isEnabled(workspace: Workspace): boolean {
    const settings = workspace.settings as {
      ai?: { generative?: boolean };
    } | null;
    return settings?.ai?.generative === true;
  }

  private assertEnabled(workspace: Workspace) {
    if (!this.isEnabled(workspace)) {
      throw new ForbiddenException(
        'Generative AI is not enabled for this workspace',
      );
    }
    if (!this.aiService.isConfigured()) {
      throw new BadRequestException('AI is not configured on this server');
    }
  }
}
