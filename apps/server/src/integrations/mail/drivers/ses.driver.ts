import { MailDriver } from './interfaces/mail-driver.interface';
import { SESConfig, SMTPConfig } from '../interfaces';
import { Transporter } from 'nodemailer';
import * as nodemailer from 'nodemailer';
import { MailMessage } from '../interfaces/mail.message';
import { Logger } from '@nestjs/common';
import { mailLogName } from '../mail.utils';
import * as aws from '@aws-sdk/client-ses';

export class SESDriver implements MailDriver {
  private readonly logger = new Logger(mailLogName(SESDriver.name));
  private readonly transporter: Transporter;

  constructor(config: SESConfig) {
    this.transporter = nodemailer.createTransport({
      SES: {
        ses: new aws.SES({
          region: config.region,
        }),
        aws,
      },
    });
  }

  async sendMail(message: MailMessage): Promise<void> {
    try {
      await this.transporter.sendMail({
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
