export const AuditEvent = {
  // Workspace
  WORKSPACE_CREATED: 'workspace.created',
  WORKSPACE_UPDATED: 'workspace.updated',
  WORKSPACE_INVITE_CREATED: 'workspace.invite_created',
  WORKSPACE_INVITE_RESENT: 'workspace.invite_resent',
  WORKSPACE_INVITE_REVOKED: 'workspace.invite_revoked',

  // User
  USER_CREATED: 'user.created',
  USER_DELETED: 'user.deleted',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_ROLE_CHANGED: 'user.role_changed',
  USER_PASSWORD_CHANGED: 'user.password_changed',
  USER_PASSWORD_RESET: 'user.password_reset',
  USER_UPDATED: 'user.updated',

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

  // Group
  GROUP_CREATED: 'group.created',
  GROUP_UPDATED: 'group.updated',
  GROUP_DELETED: 'group.deleted',
  GROUP_MEMBER_ADDED: 'group.member_added',
  GROUP_MEMBER_REMOVED: 'group.member_removed',

  // Comment
  COMMENT_CREATED: 'comment.created',
  COMMENT_DELETED: 'comment.deleted',

  // Comment updates / resolve
  COMMENT_UPDATED: 'comment.updated',
  COMMENT_RESOLVED: 'comment.resolved',
  COMMENT_REOPENED: 'comment.reopened',

  // Page
  PAGE_CREATED: 'page.created',
  PAGE_TRASHED: 'page.trashed',
  PAGE_DELETED: 'page.deleted',
  PAGE_RESTORED: 'page.restored',
  PAGE_MOVED_TO_SPACE: 'page.moved_to_space',
  PAGE_DUPLICATED: 'page.duplicated',
  // Page permission
  PAGE_RESTRICTED: 'page.restricted',
  PAGE_RESTRICTION_REMOVED: 'page.restriction_removed',
  PAGE_PERMISSION_ADDED: 'page.permission_added',
  PAGE_PERMISSION_REMOVED: 'page.permission_removed',

  // Share
  SHARE_CREATED: 'share.created',
  SHARE_DELETED: 'share.deleted',

  // Import / Export
  PAGE_IMPORTED: 'page.imported',
  PAGE_EXPORTED: 'page.exported',
  SPACE_EXPORTED: 'space.exported',

  // SSO provider management
  SSO_PROVIDER_CREATED: 'sso.provider_created',
  SSO_PROVIDER_UPDATED: 'sso.provider_updated',
  SSO_PROVIDER_DELETED: 'sso.provider_deleted',

  // MFA
  USER_MFA_ENABLED: 'user.mfa_enabled',
  USER_MFA_DISABLED: 'user.mfa_disabled',
  USER_MFA_BACKUP_CODE_GENERATED: 'user.mfa_backup_code_generated',

  // License
  LICENSE_ACTIVATED: 'license.activated',
  LICENSE_REMOVED: 'license.removed',

  // Attachment
  ATTACHMENT_UPLOADED: 'attachment.uploaded',
  // ATTACHMENT_DELETED: 'attachment.deleted',
} as const;

export type AuditEventType = (typeof AuditEvent)[keyof typeof AuditEvent];

export const EXCLUDED_AUDIT_EVENTS: Set<string> = new Set([
  AuditEvent.PAGE_CREATED,
  AuditEvent.PAGE_MOVED_TO_SPACE,
  AuditEvent.PAGE_DUPLICATED,
  AuditEvent.COMMENT_CREATED,
  AuditEvent.COMMENT_UPDATED,
  AuditEvent.COMMENT_RESOLVED,
  AuditEvent.COMMENT_REOPENED,
]);

export const AuditResource = {
  WORKSPACE: 'workspace',
  USER: 'user',
  PAGE: 'page',
  SPACE: 'space',
  SPACE_MEMBER: 'space_member',
  GROUP: 'group',
  COMMENT: 'comment',
  SHARE: 'share',
  API_KEY: 'api_key',
  SSO_PROVIDER: 'sso_provider',
  WORKSPACE_INVITATION: 'workspace_invitation',
  ATTACHMENT: 'attachment',
  LICENSE: 'license',
} as const;

export type AuditResourceType =
  (typeof AuditResource)[keyof typeof AuditResource];

export type ActorType = 'user' | 'system' | 'api_key';

export interface AuditLogPayload {
  event: AuditEventType;
  resourceType: AuditResourceType;
  resourceId?: string;
  spaceId?: string;
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
