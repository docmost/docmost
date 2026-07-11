import { OnModuleDestroy } from '@nestjs/common';
import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MailService } from '../mail.service';
import { MailMessage } from '../interfaces/mail.message';
import { NotificationRepo } from "../../../database/repos/notification/notification.repo";
export declare class EmailProcessor extends WorkerHost implements OnModuleDestroy {
    private readonly mailService;
    private readonly notificationRepo;
    private readonly logger;
    constructor(mailService: MailService, notificationRepo: NotificationRepo);
    process(job: Job<MailMessage, void>): Promise<void>;
    onActive(job: Job): void;
    onError(job: Job): void;
    onCompleted(job: Job): void;
    onModuleDestroy(): Promise<void>;
}
