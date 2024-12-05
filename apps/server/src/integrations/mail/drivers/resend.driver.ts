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
    this.logger.debug(`TOKEN ${config.resendApiToken}`);
    this.resendClient = new Resend(config.resendApiToken);
  }

  private formatEmailAddress(email: string): string {
    if (email.includes('<') && email.includes('>')) {
      const matches = email.match(/<(.+)>/);
      if (matches && matches[1]) {
        return matches[1];
      }
    }
    return email;
  }

  async sendMail(message: MailMessage): Promise<void> {
    try {
      const fromEmail = this.formatEmailAddress(message.from);
      this.logger.debug(`Attempting to send mail from ${fromEmail}`);

      const { data, error } = await this.resendClient.emails.send({
        from: fromEmail,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      if (error) {
        this.logger.error(`Failed to send mail: ${error.message}`);
        throw new Error(error.message);
      }

      this.logger.debug(`Email sent successfully. ID: ${data?.id}`);
    } catch (err) {
      this.logger.error(`Failed to send mail: ${err}`);
      throw err;
    }
  }
}
