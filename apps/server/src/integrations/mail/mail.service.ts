import { Inject, Injectable, Logger } from '@nestjs/common';
import { MAIL_DRIVER_TOKEN } from './mail.constants';
import { MailDriver } from './drivers/interfaces/mail-driver.interface';
import { MailMessage } from './interfaces/mail.message';
import { EnvironmentService } from '../environment/environment.service';
import { render } from '@react-email/render';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  
  constructor(
    @Inject(MAIL_DRIVER_TOKEN) private mailDriver: MailDriver,
    private readonly environmentService: EnvironmentService,
  ) {}

  async sendEmail(message: MailMessage): Promise<void> {
    this.logger.log(`sendEmail called - to: ${message.to}, subject: ${message.subject}`);
    
    if (message.template) {
      // in case this method is used directly. we do not send the tsx template from queue
      message.html = await render(message.template, {
        pretty: true,
      });
      message.text = await render(message.template, {
        plainText: true,
      });
    }

    let from = this.environmentService.getMailFromAddress();
    if (message.from) {
      from = message.from;
    }

    const sender = `${this.environmentService.getMailFromName()} <${from}> `;
    this.logger.log(`Sending email from: ${sender} to: ${message.to}`);
    
    // Send email asynchronously to avoid blocking HTTP requests
    this.mailDriver.sendMail({ from: sender, ...message })
      .then(() => {
        this.logger.log(`Email sent successfully to: ${message.to}`);
      })
      .catch((error) => {
        this.logger.error(`Failed to send email to ${message.to}: ${error.message}`);
      });
  }

  async sendToQueue(message: MailMessage): Promise<void> {
    this.logger.log(`sendToQueue called - to: ${message.to}, subject: ${message.subject}`);
    // Directly send email instead of using queue
    await this.sendEmail(message);
  }
}
