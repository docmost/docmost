export const Feature = {
  SSO_CUSTOM: 'sso:custom',
  SSO_GOOGLE: 'sso:google',
  MFA: 'mfa',
  API_KEYS: 'api:keys',
  COMMENT_RESOLUTION: 'comment:resolution',
  PAGE_PERMISSIONS: 'page:permissions',
  AI: 'ai',
  CONFLUENCE_IMPORT: 'import:confluence',
  DOCX_IMPORT: 'import:docx',
  PDF_IMPORT: 'import:pdf',
  ATTACHMENT_INDEXING: 'attachment:indexing',
  SECURITY_SETTINGS: 'security:settings',
  MCP: 'mcp',
  SCIM: 'scim',
  PAGE_VERIFICATION: 'page:verification',
  AUDIT_LOGS: 'audit:logs',
  RETENTION: 'retention',
  SHARING_CONTROLS: 'sharing:controls',
  VIEWER_COMMENTS: 'comment:viewer',
  TEMPLATES: 'templates',
  PDF_EXPORT: 'export:pdf',
  PERSONAL_SPACES: 'spaces:personal',
  DOCX_EXPORT: 'export:docx',
  BASES: 'bases',
} as const;

export type FeatureKey = (typeof Feature)[keyof typeof Feature];

/**
 * Features whose HTTP routes live in the `apps/server/src/ee` submodule.
 *
 * `SELF_HOSTED_UNLOCK_FEATURES` only flips entitlement flags — it does not
 * bring the submodule with it. Unlocking any of these without `ee` provisioned
 * makes the client mount UI that POSTs to routes Nest never registered, which
 * surfaces to the user as `Cannot POST /api/... - Not Found`.
 *
 * Each key here was confirmed by checking that no `@Controller` under
 * `apps/server/src` serves the paths its client service calls. Keys backed by
 * AGPL controllers in `core/` (audit:logs, retention, sharing:controls,
 * comment:resolution, comment:viewer, security:settings, sso:google,
 * attachment:indexing, import:*, export:pdf) are deliberately absent.
 *
 * See docs/ee-feature-status.md.
 */
export const FEATURES_REQUIRING_EE_MODULE: FeatureKey[] = [
  Feature.SSO_CUSTOM, // /sso/info, /sso/providers, /sso/create|update|delete
  Feature.MFA, // /mfa/*
  Feature.API_KEYS, // /api-keys/*
  Feature.PAGE_PERMISSIONS, // /pages/restrict, /pages/permission-info, ...
  Feature.AI, // /ai/generate, /ai/chats/*
  Feature.MCP, // /mcp
  Feature.SCIM, // /scim-tokens/*
  Feature.PAGE_VERIFICATION, // /pages/verification-info, /pages/verify, ...
  Feature.TEMPLATES, // /templates/*
  Feature.PERSONAL_SPACES, // /personal-space/info, /personal-space/create
  Feature.BASES, // /bases/*
  Feature.DOCX_EXPORT, // /docx-export
];
