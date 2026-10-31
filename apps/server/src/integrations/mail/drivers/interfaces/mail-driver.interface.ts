import { MailMessage } from '../../interfaces/mail.message.js';

export interface MailDriver {
  sendMail(message: MailMessage): Promise<void>;
}
