import { MailDriver } from './interfaces/mail-driver.interface';
import { PostmarkConfig } from '../interfaces';
import { MailMessage } from '../interfaces/mail.message';
export declare class PostmarkDriver implements MailDriver {
    private readonly logger;
    private readonly postmarkClient;
    constructor(config: PostmarkConfig);
    sendMail(message: MailMessage): Promise<void>;
}
