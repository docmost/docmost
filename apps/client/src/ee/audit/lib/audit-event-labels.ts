type EventOption = {
  value: string;
  label: string;
};

type EventGroup = {
  group: string;
  items: EventOption[];
};

export const auditEventLabels: Record<string, string> = {
  "workspace.created": "Created workspace",
  "workspace.updated": "Updated workspace",
  "workspace.invite_created": "Created invitation",
  "workspace.invite_resent": "Resent invitation",
  "workspace.invite_revoked": "Revoked invitation",

  "user.created": "Created user",
  "user.deleted": "Deleted user",
  "user.login": "Logged in",
  "user.logout": "Logged out",
  "user.role_changed": "Changed user role",
  "user.password_changed": "Changed password",
  "user.password_reset": "Reset password",
  "user.updated": "Updated user",
  "user.mfa_enabled": "Enabled MFA",
  "user.mfa_disabled": "Disabled MFA",
  "user.mfa_backup_code_generated": "Generated MFA backup codes",

  "api_key.created": "Created API key",
  "api_key.updated": "Updated API key",
  "api_key.deleted": "Deleted API key",

  "space.created": "Created space",
  "space.updated": "Updated space",
  "space.deleted": "Deleted space",
  "space.member_added": "Added space member",
  "space.member_removed": "Removed space member",
  "space.member_role_changed": "Changed space member role",
  "space.exported": "Exported space",

  "group.created": "Created group",
  "group.updated": "Updated group",
  "group.deleted": "Deleted group",
  "group.member_added": "Added group member",
  "group.member_removed": "Removed group member",

  "comment.deleted": "Deleted comment",

  "page.trashed": "Trashed page",
  "page.deleted": "Deleted page",
  "page.restored": "Restored page",
  "page.imported": "Imported page",
  "page.exported": "Exported page",
  "page.restricted": "Restricted page",
  "page.restriction_removed": "Removed page restriction",
  "page.permission_added": "Added page permission",
  "page.permission_removed": "Removed page permission",

  "share.created": "Created share link",
  "share.deleted": "Deleted share link",

  "sso.provider_created": "Created SSO provider",
  "sso.provider_updated": "Updated SSO provider",
  "sso.provider_deleted": "Deleted SSO provider",

  "license.activated": "Activated license",
  "license.removed": "Removed license",
};

export function getEventLabel(event: string): string {
  return auditEventLabels[event] ?? event;
}

export const eventFilterOptions: EventGroup[] = [
  {
    group: "Workspace",
    items: [
      { value: "workspace.updated", label: "Updated workspace" },
      { value: "workspace.invite_created", label: "Created invitation" },
      { value: "workspace.invite_revoked", label: "Revoked invitation" },
    ],
  },
  {
    group: "User",
    items: [
      { value: "user.login", label: "Logged in" },
      { value: "user.logout", label: "Logged out" },
      { value: "user.created", label: "Created user" },
      { value: "user.deleted", label: "Deleted user" },
      { value: "user.role_changed", label: "Changed user role" },
      { value: "user.password_changed", label: "Changed password" },
      { value: "user.mfa_enabled", label: "Enabled MFA" },
      { value: "user.mfa_disabled", label: "Disabled MFA" },
    ],
  },
  {
    group: "Space",
    items: [
      { value: "space.created", label: "Created space" },
      { value: "space.updated", label: "Updated space" },
      { value: "space.deleted", label: "Deleted space" },
      { value: "space.member_added", label: "Added space member" },
      { value: "space.member_removed", label: "Removed space member" },
    ],
  },
  {
    group: "Group",
    items: [
      { value: "group.created", label: "Created group" },
      { value: "group.updated", label: "Updated group" },
      { value: "group.deleted", label: "Deleted group" },
      { value: "group.member_added", label: "Added group member" },
      { value: "group.member_removed", label: "Removed group member" },
    ],
  },
  {
    group: "Comment",
    items: [
      { value: "comment.deleted", label: "Deleted comment" },
    ],
  },
  {
    group: "Page",
    items: [
      { value: "page.trashed", label: "Trashed page" },
      { value: "page.deleted", label: "Deleted page" },
      { value: "page.restored", label: "Restored page" },
      { value: "page.imported", label: "Imported page" },
      { value: "page.exported", label: "Exported page" },
      { value: "page.restricted", label: "Restricted page" },
      { value: "page.restriction_removed", label: "Removed page restriction" },
      { value: "page.permission_added", label: "Added page permission" },
      { value: "page.permission_removed", label: "Removed page permission" },
    ],
  },
  {
    group: "Share",
    items: [
      { value: "share.created", label: "Created share link" },
      { value: "share.deleted", label: "Deleted share link" },
    ],
  },
  {
    group: "SSO",
    items: [
      { value: "sso.provider_created", label: "Created SSO provider" },
      { value: "sso.provider_updated", label: "Updated SSO provider" },
      { value: "sso.provider_deleted", label: "Deleted SSO provider" },
    ],
  },
  {
    group: "API key",
    items: [
      { value: "api_key.created", label: "Created API key" },
      { value: "api_key.deleted", label: "Deleted API key" },
    ],
  },
  {
    group: "License",
    items: [
      { value: "license.activated", label: "Activated license" },
      { value: "license.removed", label: "Removed license" },
    ],
  },
];
