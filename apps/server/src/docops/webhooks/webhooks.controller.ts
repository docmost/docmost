import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { User } from '@docmost/db/types/entity.types';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';

@UseGuards(JwtAuthGuard)
@Controller('docops/webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @HttpCode(HttpStatus.OK)
  @Post('/')
  list(@AuthUser() user: User) {
    return this.webhooksService.listWebhooks(user);
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  create(@Body() dto: CreateWebhookDto, @AuthUser() user: User) {
    return this.webhooksService.createWebhook(dto, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  update(@Body() dto: UpdateWebhookDto, @AuthUser() user: User) {
    return this.webhooksService.updateWebhook(dto, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  delete(@Body() body: { id: string }, @AuthUser() user: User) {
    return this.webhooksService.deleteWebhook(body.id, user);
  }
}
