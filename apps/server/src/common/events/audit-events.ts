export const AuditEvent = {
  // Workspace Invitations
  WORKSPACE_CREATED: 'workspace.created',
  WORKSPACE_INVITE_CREATED: 'workspace.invite_created',
  WORKSPACE_INVITE_REVOKED: 'workspace.invite_revoked',

  WORKSPACE_INVITE_ACCEPTED: 'workspace.invite_accepted',

  WORKSPACE_USER_CREATED: 'workspace.user_created',
  WORKSPACE_USER_DEACTIVATED: 'workspace.user_deactivated',

  WORKSPACE_ALLOWED_DOMAIN_UPDATED: 'workspace.allowed_domain_updated',
  WORKSPACE_ICON_CHANGED: 'workspace.icon_changed',
  WORKSPACE_NAME_CHANGED: 'workspace.name_changed',

  WORKSPACE_AI_TOGGLED: 'workspace.ai_toggled',

  USER_CREATED: 'user.created',
  USER_DELETED: 'user.deleted',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_ROLE_CHANGED: 'user.user_role_changed',
  USER_PASSWORD_CHANGED: 'user.password_changed',
  USER_PASSWORD_RESET: 'user.reset_password',
  USER_PHOTO_CHANGED: 'user.reset_password',
  USER_NAME_CHANGED: 'user.name_changed',
  USER_EMAIL_CHANGED: 'user.email_changed',
  USER_MFA_SETUP: 'user.mfa_setup',
  USER_MFA_BACKUP_CODE_GENERATED: 'user.mfa_backup_code_generated',

  // API Keys
  API_KEY_CREATED: 'api_key.created',
  API_KEY_UPDATED: 'api_key.updated',
  API_KEY_DELETED: 'api_key.deleted',

  // Space
  SPACE_CREATED: 'space.created',
  SPACE_UPDATED: 'space.updated',
  SPACE_DELETED: 'space.deleted',

  SPACE_MEMBER_ADDED: 'space.member_added',
  SPACE_MEMBER_REMOVED: 'space.member_removed',
  SPACE_MEMBER_ROLE_CHANGED: 'space.member_role_changed',

  // OR SPACE_USER_ADDED: 'space.user_added',
  // SPACE_GROUP_ADDED: 'space.group_added',

  // GROUP
  GROUP_CREATED: 'group.created',
  GROUP_UPDATED: 'group.updated',
  GROUP_DELETED: 'group.deleted',

  GROUP_MEMBER_ADDED: 'group.member_added',
  GROUP_MEMBER_REMOVED: 'group.member_removed',

  // Comments
  COMMENT_CREATED: 'comment.created',
  COMMENT_UPDATED: 'comment.updated',
  COMMENT_DELETED: 'comment.deleted',
  COMMENT_RESOLVED: 'comment.resolved',
  COMMENT_REOPENED: 'comment.reopened',

  // PAGE
  PAGE_CREATED: 'page.created',
  PAGE_UPDATED: 'page.updated',
  PAGE_TRASHED: 'page.trash',
  PAGE_DELETED: 'page.deleted',
  PAGE_SHARED: 'page.shared',

  ATTACHMENT_UPLOADED: 'attachment.uploaded',

  PAGE_IMPORTED: 'page.imported',
  PAGE_RESTORED: 'page.restored',
  PAGE_EXPORTED: 'page.exported',
  SPACE_EXPORTED: 'space.imported',

  // SSO EVENTS
} as const;

export type AuditEventType = (typeof AuditEvent)[keyof typeof AuditEvent];

export type ActorType = 'user' | 'system' | 'api_key';

export interface AuditLogPayload {
  event: AuditEventType;
  resourceType: string;
  resourceId?: string;
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  };
  metadata?: Record<string, any>;
}

export interface AuditLogData extends AuditLogPayload {
  workspaceId: string;
  actorId?: string;
  actorType: ActorType;
  ipAddress?: string;
  userAgent?: string;
}
