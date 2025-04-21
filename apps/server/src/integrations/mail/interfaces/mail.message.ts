export interface MailMessage {
  from?: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  template?: any;
}
