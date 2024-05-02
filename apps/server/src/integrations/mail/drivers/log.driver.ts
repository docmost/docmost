import { MailDriver } from './interfaces/mail-driver.interface';
import { Logger } from '@nestjs/common';
import { MailMessage } from '../interfaces/mail.message';
import { mailLogName } from '../mail.utils';

export class LogDriver implements MailDriver {
  private readonly logger = new Logger(mailLogName(LogDriver.name));

  async sendMail(message: MailMessage): Promise<void> {
    const mailLog = {
      to: message.to,
      subject: message.subject,
      text: message.text,
    };

    this.logger.log(`Logged mail: ${JSON.stringify(mailLog)}`);
  }
}
