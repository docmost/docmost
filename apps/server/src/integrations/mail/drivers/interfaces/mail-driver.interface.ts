import { MailMessage } from '../../interfaces/mail.message';

export interface MailDriver {
  sendMail(message: MailMessage): Promise<void>;
}
