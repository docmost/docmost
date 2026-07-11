import { MailDriver } from './interfaces/mail-driver.interface';
import { MailMessage } from '../interfaces/mail.message';
export declare class LogDriver implements MailDriver {
    private readonly logger;
    sendMail(message: MailMessage): Promise<void>;
}
