export enum QueueName {
  EMAIL_QUEUE = '{email-queue}',
  ATTACHMENT_QUEUE = '{attachment-queue}',
  GENERAL_QUEUE = '{general-queue}',
  BILLING_QUEUE = '{billing-queue}',
}

export enum QueueJob {
  SEND_EMAIL = 'send-email',
  DELETE_SPACE_ATTACHMENTS = 'delete-space-attachments',
  DELETE_PAGE_ATTACHMENTS = 'delete-page-attachments',
  PAGE_CONTENT_UPDATE = 'page-content-update',

  PAGE_BACKLINKS = 'page-backlinks',

  STRIPE_SEATS_SYNC = 'sync-stripe-seats',

  TRIAL_ENDED = 'trial-ended',
}
