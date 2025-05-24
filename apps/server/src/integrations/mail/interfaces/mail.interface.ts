import SMTPTransport from 'nodemailer/lib/smtp-transport';

export enum MailOption {
  SMTP = 'smtp',
  Postmark = 'postmark',
  Log = 'log',
  SES = 'ses',
}

export type MailConfig =
  | { driver: MailOption.SMTP; config: SMTPConfig }
  | { driver: MailOption.Postmark; config: PostmarkConfig }
  | { driver: MailOption.Log; config: LogConfig }
  | { driver: MailOption.SES; config: SESConfig };

export interface SMTPConfig extends SMTPTransport.Options {}
export interface PostmarkConfig {
  postmarkToken: string;
}
export interface LogConfig {}
export interface SESConfig {
  /** AWS region, e.g. 'us-east-1' */
  region?: string;
  /** AWS access key ID */
  accessKeyId?: string;
  /** AWS secret access key */
  secretAccessKey?: string;
}

export interface MailOptions {
  mail: MailConfig;
}

export interface MailOptionsFactory {
  createMailOptions(): Promise<MailConfig> | MailConfig;
}

export interface MailModuleOptions {
  imports?: any[];
}
