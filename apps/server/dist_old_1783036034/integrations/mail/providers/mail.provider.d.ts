import { EnvironmentService } from '../../environment/environment.service';
import { MailOption, PostmarkConfig } from '../interfaces';
import { MailDriver } from '../drivers/interfaces/mail-driver.interface';
import { MailConfig } from '../interfaces';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
export declare const mailDriverConfigProvider: {
    provide: string;
    useFactory: (environmentService: EnvironmentService) => Promise<{
        driver: MailOption.SMTP;
        config: SMTPTransport.Options;
    } | {
        driver: MailOption.Postmark;
        config: PostmarkConfig;
    } | {
        driver: MailOption.Log;
        config?: undefined;
    }>;
    inject: (typeof EnvironmentService)[];
};
export declare const mailDriverProvider: {
    provide: string;
    useFactory: (config: MailConfig) => MailDriver;
    inject: string[];
};
