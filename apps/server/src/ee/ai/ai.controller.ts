import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { AiService, AiGenerateInput } from './ai.service';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { Feature } from '../../common/features';
import { FastifyReply } from 'fastify';
import { SearchDTO } from '../../core/search/dto/search.dto';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @HttpCode(HttpStatus.OK)
  @Post('generate')
  @RequireFeature(Feature.AI)
  async generate(
    @Body() body: AiGenerateInput,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.aiService.generate(body, workspace.id);
  }

  @Post('generate/stream')
  @RequireFeature(Feature.AI)
  async generateStream(
    @Body() body: AiGenerateInput,
    @AuthWorkspace() workspace: Workspace,
    @Res() res: FastifyReply,
  ) {
    res.raw.setHeader('Content-Type', 'text/event-stream');
    res.raw.setHeader('Cache-Control', 'no-cache');
    res.raw.setHeader('Connection', 'keep-alive');

    try {
      for await (const chunk of this.aiService.generateStream(
        body,
        workspace.id,
      )) {
        if ('error' in chunk) {
          res.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
        } else {
          res.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
      }
      res.raw.write('data: [DONE]\n\n');
    } catch (err: any) {
      res.raw.write(
        `data: ${JSON.stringify({ error: err?.message ?? 'Generation failed' })}\n\n`,
      );
    }
    res.raw.end();
  }

  @Post('answers')
  @RequireFeature(Feature.AI)
  async answers(
    @Body() body: SearchDTO,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Res() res: FastifyReply,
  ) {
    res.raw.setHeader('Content-Type', 'text/event-stream');
    res.raw.setHeader('Cache-Control', 'no-cache');
    res.raw.setHeader('Connection', 'keep-alive');

    try {
      for await (const chunk of this.aiService.answerStream(body, {
        userId: user.id,
        workspaceId: workspace.id,
      })) {
        res.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.raw.write('data: [DONE]\n\n');
    } catch (err: any) {
      res.raw.write(
        `data: ${JSON.stringify({ error: err?.message ?? 'Search failed' })}\n\n`,
      );
    }
    res.raw.end();
  }
}
