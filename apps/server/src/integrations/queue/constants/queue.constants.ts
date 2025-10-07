export enum QueueName {
  EMAIL_QUEUE = '{email-queue}',
  ATTACHMENT_QUEUE = '{attachment-queue}',
  GENERAL_QUEUE = '{general-queue}',
  BILLING_QUEUE = '{billing-queue}',
  FILE_TASK_QUEUE = '{file-task-queue}',
  SEARCH_QUEUE = '{search-queue}',
}

export enum QueueJob {
  SEND_EMAIL = 'send-email',
  DELETE_SPACE_ATTACHMENTS = 'delete-space-attachments',
  ATTACHMENT_INDEX_CONTENT = 'attachment-index-content',
  ATTACHMENT_INDEXING = 'attachment-indexing',
  DELETE_PAGE_ATTACHMENTS = 'delete-page-attachments',
  PAGE_CONTENT_UPDATE = 'page-content-update',

  DELETE_USER_AVATARS = 'delete-user-avatars',

  PAGE_BACKLINKS = 'page-backlinks',

  STRIPE_SEATS_SYNC = 'sync-stripe-seats',
  TRIAL_ENDED = 'trial-ended',
  WELCOME_EMAIL = 'welcome-email',
  FIRST_PAYMENT_EMAIL = 'first-payment-email',

  IMPORT_TASK = 'import-task',
  EXPORT_TASK = 'export-task',

  SEARCH_INDEX_PAGE = 'search-index-page',
  SEARCH_INDEX_PAGES = 'search-index-pages',
  SEARCH_INDEX_COMMENT = 'search-index-comment',
  SEARCH_INDEX_COMMENTS = 'search-index-comments',
  SEARCH_INDEX_ATTACHMENT = 'search-index-attachment',
  SEARCH_INDEX_ATTACHMENTS = 'search-index-attachments',
  SEARCH_REMOVE_PAGE = 'search-remove-page',
  SEARCH_REMOVE_ASSET = 'search-remove-attachment',
  SEARCH_REMOVE_FACE = 'search-remove-comment',
  TYPESENSE_FLUSH = 'typesense-flush',

  PAGE_CREATED = 'page-created',
  PAGE_UPDATED = 'page-updated',
  PAGE_SOFT_DELETED = 'page-soft-deleted',
  PAGE_RESTORED = 'page-restored',
  PAGE_DELETED = 'page-deleted',
}
