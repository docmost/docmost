import SMTPTransport from 'nodemailer/lib/smtp-transport';

export enum MailOption {
  SMTP = 'smtp',
  Postmark = 'postmark',
  SES = 'ses',
  Log = 'log',
}

export type MailConfig =
  | { driver: MailOption.SMTP; config: SMTPConfig }
  | { driver: MailOption.Postmark; config: PostmarkConfig }
  | { driver: MailOption.SES; config: SESConfig }
  | { driver: MailOption.Log; config: LogConfig };

export interface SESConfig {
  region: string;
}

export interface SMTPConfig extends SMTPTransport.Options {}

export interface PostmarkConfig {
  postmarkToken: string;
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
