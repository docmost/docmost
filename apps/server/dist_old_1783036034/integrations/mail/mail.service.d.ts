import { MailDriver } from './drivers/interfaces/mail-driver.interface';
import { MailMessage } from './interfaces/mail.message';
import { EnvironmentService } from '../environment/environment.service';
import { Queue } from 'bullmq';
export declare class MailService {
    private mailDriver;
    private readonly environmentService;
    private emailQueue;
    constructor(mailDriver: MailDriver, environmentService: EnvironmentService, emailQueue: Queue);
    sendEmail(message: MailMessage): Promise<void>;
    sendToQueue(message: MailMessage): Promise<void>;
    private isRecipientBlocked;
}
