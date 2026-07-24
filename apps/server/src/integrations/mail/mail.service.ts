import { Inject, Injectable, Logger } from '@nestjs/common';
import { MAIL_DRIVER_TOKEN } from './mail.constants';
import { MailDriver } from './drivers/interfaces/mail-driver.interface';
import { MailMessage } from './interfaces/mail.message';
import { EnvironmentService } from '../environment/environment.service';
import { InjectQueue } from '@nestjs/bullmq';
import { QueueName, QueueJob } from '../queue/constants';
import { Queue } from 'bullmq';
import { render } from 'react-email';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(MAIL_DRIVER_TOKEN) private mailDriver: MailDriver,
    private readonly environmentService: EnvironmentService,
    @InjectQueue(QueueName.EMAIL_QUEUE) private emailQueue: Queue,
  ) {
    const driver = this.environmentService.getMailDriver();
    const fromAddress = this.environmentService.getMailFromAddress();
    this.logger.log(
      `Mail config resolved: driver=${driver} host=${this.environmentService.getSmtpHost()} ` +
        `port=${this.environmentService.getSmtpPort()} secure=${this.environmentService.getSmtpSecure()} ` +
        `ignoreTLS=${this.environmentService.getSmtpIgnoreTLS()} ` +
        `authUser=${this.environmentService.getSmtpUsername() ? '<set>' : '<none>'} ` +
        `fromAddress=${fromAddress || '<empty>'} fromName=${this.environmentService.getMailFromName()} ` +
        `debug=${this.environmentService.isDebugMode()}`,
    );
    if (driver === 'log') {
      this.logger.warn(
        'MAIL_DRIVER is "log" (default): emails are only logged, not sent. Set MAIL_DRIVER=smtp to deliver mail.',
      );
    }
    if (driver === 'smtp' && !fromAddress) {
      this.logger.warn(
        'MAIL_FROM_ADDRESS is empty: the sender becomes "Docmost <undefined>" and most SMTP servers will reject it.',
      );
    }
  }

  async sendEmail(message: MailMessage): Promise<void> {
    if (this.isRecipientBlocked(message.to)) {
      return;
    }

    if (message.template) {
      // in case this method is used directly. we do not send the tsx template from queue
      message.html = await render(message.template, {
        pretty: true,
      });
      message.text = await render(message.template, { plainText: true });
    }

    let from = this.environmentService.getMailFromAddress();
    if (message.from) {
      from = message.from;
    }

    const sender = `${this.environmentService.getMailFromName()} <${from}> `;
    await this.mailDriver.sendMail({ from: sender, ...message });
  }

  async sendToQueue(message: MailMessage): Promise<void> {
    if (this.isRecipientBlocked(message.to)) {
      return;
    }

    if (message.template) {
      // transform the React object because it gets lost when sent via the queue
      message.html = await render(message.template, {
        pretty: true,
      });
      message.text = await render(message.template, {
        plainText: true,
      });
      delete message.template;
    }

    this.logger.log(`Queued email to ${message.to} (subject: "${message.subject}")`);
    try {
      const job = await this.emailQueue.add(QueueJob.SEND_EMAIL, message);
      this.logger.log(`Enqueued email to ${message.to} as jobId=${job.id}`);
    } catch (err: any) {
      this.logger.error(
        `Failed to enqueue email to ${message.to}: ${err?.message}`,
        err?.stack,
      );
      throw err;
    }
  }

  private isRecipientBlocked(to: string): boolean {
    const blocked = this.environmentService.getMailBlockedRecipientDomains();
    if (blocked.length === 0) return false;
    const domain = to?.split('@')[1]?.toLowerCase();
    const isBlocked = !!domain && blocked.includes(domain);
    if (isBlocked) {
      this.logger.warn(
        `Skipped mail to ${to}: domain is in MAIL_BLOCKED_RECIPIENT_DOMAINS`,
      );
    }
    return isBlocked;
  }
}
