import { MailDriver } from './interfaces/mail-driver.interface';
import { SMTPConfig } from '../interfaces';
import { MailMessage } from '../interfaces/mail.message';
export declare class SmtpDriver implements MailDriver {
    private readonly logger;
    private readonly transporter;
    constructor(config: SMTPConfig);
    sendMail(message: MailMessage): Promise<void>;
}
