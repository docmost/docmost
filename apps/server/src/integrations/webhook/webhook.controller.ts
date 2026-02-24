import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User, Workspace } from '@docmost/db/types/entity.types';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsArray,
} from 'class-validator';

class UpdateWebhookDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @IsString()
  url: string;

  @IsOptional()
  @IsEnum(['discord', 'slack', 'generic'])
  format?: 'discord' | 'slack' | 'generic';

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];
}

@UseGuards(JwtAuthGuard)
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @HttpCode(HttpStatus.OK)
  @Get()
  async getWebhook(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const webhook = await this.webhookService.getUserWebhook(
      user.id,
      workspace.id,
    );
    if (!webhook) {
      return { webhook: null };
    }
    // Don't expose the full URL for security, just indicate it's configured
    return {
      webhook: {
        id: webhook.id,
        format: webhook.format,
        enabled: webhook.enabled,
        events: webhook.events,
        urlConfigured: true,
        lastTriggeredAt: webhook.lastTriggeredAt,
        failureCount: webhook.failureCount,
      },
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  async updateWebhook(
    @Body() dto: UpdateWebhookDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    // Validate URL is HTTPS (except localhost for development)
    const url = new URL(dto.url);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
      return {
        success: false,
        error: 'Webhook URL must use HTTPS',
      };
    }

    // Block internal network URLs (SSRF protection)
    const hostname = url.hostname;
    if (
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('172.2') ||
      hostname.startsWith('172.30.') ||
      hostname.startsWith('172.31.') ||
      (hostname === '127.0.0.1' && process.env.NODE_ENV === 'production')
    ) {
      return {
        success: false,
        error: 'Internal network URLs are not allowed',
      };
    }

    const webhook = await this.webhookService.createOrUpdate(
      user.id,
      workspace.id,
      dto,
    );

    return {
      success: true,
      webhook: {
        id: webhook.id,
        format: webhook.format,
        enabled: webhook.enabled,
        events: webhook.events,
      },
    };
  }

  @HttpCode(HttpStatus.OK)
  @Delete()
  async deleteWebhook(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.webhookService.delete(user.id, workspace.id);
    return { success: true };
  }

  @HttpCode(HttpStatus.OK)
  @Post('test')
  async testWebhook(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const result = await this.webhookService.sendTestWebhook(
      user.id,
      workspace.id,
    );
    return result;
  }
}
