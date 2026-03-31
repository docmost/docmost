const ALL_FEATURES = new Set([
  'sso:custom',
  'sso:google',
  'mfa',
  'api:keys',
  'comment:resolution',
  'page:permissions',
  'ai',
  'import:confluence',
  'import:docx',
  'attachment:indexing',
  'security:settings',
  'mcp',
  'scim',
  'page:verification',
  'audit:logs',
  'retention',
  'sharing:controls',
]);

export function getFeaturesForCloudPlan(plan?: string): Set<string> {
  return ALL_FEATURES;
}
