import { MailDriver } from './interfaces/mail-driver.interface';
import { SESConfig } from '../interfaces';
import { MailMessage } from '../interfaces/mail.message';
import { Logger } from '@nestjs/common';
import { mailLogName } from '../mail.utils';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

/**
 * Driver for sending email via Amazon SES using AWS SDK v3.
 */
export class SesDriver implements MailDriver {
  private readonly logger = new Logger(mailLogName(SesDriver.name));
  private readonly client: SESClient;

  constructor(config: SESConfig) {
    // AWS SDK will use default credential provider chain if credentials not provided
    this.client = new SESClient({
      region: config.region,
      credentials:
        config.accessKeyId && config.secretAccessKey
          ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
          : undefined,
    });
  }

  async sendMail(message: MailMessage): Promise<void> {
    try {
      await this.client.send(
        new SendEmailCommand({
          Source: message.from,
          Destination: { ToAddresses: Array.isArray(message.to) ? message.to : [message.to] },
          Message: {
            Subject: { Data: message.subject },
            Body: {
              Text: message.text ? { Data: message.text } : undefined,
              Html: message.html ? { Data: message.html } : undefined,
            },
          },
        }),
      );
      this.logger.debug(`Sent mail to ${message.to}`);
    } catch (err) {
      this.logger.warn(`Failed to send mail to ${message.to}: ${err}`);
      throw err;
    }
  }
}