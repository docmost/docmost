import { IntegrationManifest } from '../integration-oauth/manifest.types';
import { WINDSHIFT_RESOURCES } from './windshift.resources';

/**
 * Windshift provider definition. A workspace admin supplies the base connection
 * through Settings → Workspace integrations, or the deployment can provide
 * WINDSHIFT_* env defaults. For workspace configuration, Docmost registers a
 * public client automatically. Either way, users authorize their own
 * Windshift accounts; the admin setup is not a shared bearer token.
 */
export const WINDSHIFT_MANIFEST: IntegrationManifest = {
  id: 'windshift',
  name: 'Windshift',
  description:
    'Embed live windshift items and collection reports in docmost pages.',
  baseUrl: () => process.env.WINDSHIFT_BASE_URL ?? '',
  baseUrlPlaceholder: 'https://windshift.example.com',
  authorizePath: '/oauth/authorize',
  tokenPath: '/api/oauth/token',
  scopes: ['items:read', 'workspaces:read', 'collections:read'],
  scopeSeparator: ' ',
  pkce: true,
  dynamicClientRegistration: {
    path: '/api/oauth/register',
    clientName: 'Docmost Windshift',
  },
  clientIdEnv: 'WINDSHIFT_OAUTH_CLIENT_ID',
  clientSecretEnv: 'WINDSHIFT_OAUTH_CLIENT_SECRET',
  connectionSettings: [
    {
      key: 'defaultWorkspaceKey',
      label: 'Default workspace key',
      description:
        'Item-picker shorthand: a bare number like 123 resolves against this workspace.',
      placeholder: 'WI',
      pattern: '^[A-Za-z][A-Za-z0-9]*$',
      transform: 'uppercase',
    },
  ],
  resources: WINDSHIFT_RESOURCES,
};
