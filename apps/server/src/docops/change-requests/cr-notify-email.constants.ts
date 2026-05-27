export const DOCOPS_CR_EMAIL_QUEUE = 'docops-cr-email';
export const CR_NOTIFY_EMAIL_JOB = 'cr.notify.email';

export interface CrNotifyEmailJobData {
  action: string;
  crId: string;
  crData: {
    title: string;
    serviceId: string;
    requestedById: string;
    justification: string;
  };
  actorName: string;
}
