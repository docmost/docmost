import { MailDriver } from './interfaces/mail-driver.interface';
import { PostmarkConfig } from '../interfaces';
import { ServerClient } from 'postmark';
import { MailMessage } from '../interfaces/mail.message';
import { Logger } from '@nestjs/common';
import { mailLogName } from '../mail.utils';

export class PostmarkDriver implements MailDriver {
  private readonly logger = new Logger(mailLogName(PostmarkDriver.name));
  private readonly postmarkClient: ServerClient;

  constructor(config: PostmarkConfig) {
    this.postmarkClient = new ServerClient(config.postmarkToken);
  }

  async sendMail(message: MailMessage): Promise<void> {
    try {
      await this.postmarkClient.sendEmail({
        From: message.from,
        To: message.to,
        Subject: message.subject,
        TextBody: message.text,
        HtmlBody: message.html,
      });
      this.logger.debug(`Sent mail to ${message.to}`);
    } catch (err) {
      this.logger.warn(`Failed to send mail to ${message.to}: ${err}`);
      throw err;
    }
  }
}
