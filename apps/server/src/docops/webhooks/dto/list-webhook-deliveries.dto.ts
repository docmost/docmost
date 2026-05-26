import { IsUUID } from 'class-validator';

export class ListWebhookDeliveriesDto {
  @IsUUID()
  webhookId: string;
}
