import SMTPTransport from 'nodemailer/lib/smtp-transport';

export enum MailOption {
  SMTP = 'smtp',
  Postmark = 'postmark',
  Resend = 'resend',
  Log = 'log',
}

export type MailConfig =
  | { driver: MailOption.SMTP; config: SMTPConfig }
  | { driver: MailOption.Postmark; config: PostmarkConfig }
  | { driver: MailOption.Resend; config: ResendConfig }
  | { driver: MailOption.Log; config: LogConfig };

export interface SMTPConfig extends SMTPTransport.Options {}
export interface PostmarkConfig {
  postmarkToken: string;
}
export interface ResendConfig {
  resendApiToken: string;
}
export interface LogConfig {}

export interface MailOptions {
  mail: MailConfig;
}

export interface MailOptionsFactory {
  createMailOptions(): Promise<MailConfig> | MailConfig;
}

export interface MailModuleOptions {
  imports?: any[];
}
