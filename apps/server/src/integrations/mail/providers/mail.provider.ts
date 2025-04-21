import { EnvironmentService } from '../../environment/environment.service';
import { MailOption, PostmarkConfig, SMTPConfig } from '../interfaces';
import { SmtpDriver, PostmarkDriver, LogDriver } from '../drivers';
import { MailDriver } from '../drivers/interfaces/mail-driver.interface';
import { MailConfig } from '../interfaces';
import { MAIL_CONFIG_TOKEN, MAIL_DRIVER_TOKEN } from '../mail.constants';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

function createMailDriver(mail: MailConfig): MailDriver {
  switch (mail.driver) {
    case MailOption.SMTP:
      return new SmtpDriver(mail.config as SMTPConfig);
    case MailOption.Postmark:
      return new PostmarkDriver(mail.config as PostmarkConfig);
    case MailOption.Log:
      return new LogDriver();
    default:
      throw new Error(`Unknown mail driver`);
  }
}

export const mailDriverConfigProvider = {
  provide: MAIL_CONFIG_TOKEN,
  useFactory: async (environmentService: EnvironmentService) => {
    const driver = environmentService.getMailDriver().toLocaleLowerCase();

    switch (driver) {
      case MailOption.SMTP: {
        let auth = undefined;
        if (
          environmentService.getSmtpUsername() &&
          environmentService.getSmtpPassword()
        ) {
          auth = {
            user: environmentService.getSmtpUsername(),
            pass: environmentService.getSmtpPassword(),
          };
        }
        return {
          driver,
          config: {
            host: environmentService.getSmtpHost(),
            port: environmentService.getSmtpPort(),
            connectionTimeout: 30 * 1000, // 30 seconds
            auth,
            secure: environmentService.getSmtpSecure(),
            ignoreTLS: environmentService.getSmtpIgnoreTLS(),
          } as SMTPTransport.Options,
        };
      }

      case MailOption.Postmark:
        return {
          driver,
          config: {
            postmarkToken: environmentService.getPostmarkToken(),
          } as PostmarkConfig,
        };

      case MailOption.Log:
        return {
          driver,
        };
      default:
        throw new Error(`Unknown mail driver: ${driver}`);
    }
  },

  inject: [EnvironmentService],
};

export const mailDriverProvider = {
  provide: MAIL_DRIVER_TOKEN,
  useFactory: (config: MailConfig) => createMailDriver(config),
  inject: [MAIL_CONFIG_TOKEN],
};
