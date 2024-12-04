import { MailDriver } from './interfaces/mail-driver.interface';
import { ResendConfig } from '../interfaces';
import { Resend } from 'resend';
import { MailMessage } from '../interfaces/mail.message';
import { Logger } from '@nestjs/common';
import { mailLogName } from '../mail.utils';

export class ResendDriver implements MailDriver {
  private readonly logger = new Logger(mailLogName(ResendDriver.name));
  private readonly resendClient: Resend;

  constructor(config: ResendConfig) {
    this.resendClient = new Resend(config.resendApiToken);
  }

  async sendMail(message: MailMessage): Promise<void> {
    try {
      await this.resendClient.emails.send({
        from: message.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      this.logger.debug(`Sent mail to ${message.to}`);
    } catch (err) {
      this.logger.warn(`Failed to send mail to ${message.to}: ${err}`);
      throw err;
    }
  }
}
