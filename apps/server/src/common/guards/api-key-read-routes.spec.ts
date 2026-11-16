import { listApiKeyReadRoutes } from '../../../test/api-key-read-routes.helper';

// Read-only API keys reach these. Add a route only if it changes nothing and returns no credentials.
const READ_ROUTES = [
  'GET /files/:fileId/:fileName',
  'POST /comments',
  'POST /comments/info',
  'POST /favorites',
  'POST /favorites/ids',
  'POST /file-tasks',
  'POST /file-tasks/info',
  'POST /files/info',
  'POST /groups',
  'POST /groups/info',
  'POST /groups/members',
  'POST /labels',
  'POST /labels/pages',
  'POST /notifications',
  'POST /notifications/unread-count',
  'POST /pages/attachments',
  'POST /pages/backlinks',
  'POST /pages/backlinks-count',
  'POST /pages/breadcrumbs',
  'POST /pages/created-by-user',
  'POST /pages/export',
  'POST /pages/history',
  'POST /pages/history/info',
  'POST /pages/info',
  'POST /pages/labels',
  'POST /pages/recent',
  'POST /pages/sidebar-pages',
  'POST /pages/transclusion/lookup',
  'POST /pages/transclusion/references',
  'POST /pages/trash',
  'POST /pages/watch-status',
  'POST /public-spaces',
  'POST /public-spaces/for-space',
  'POST /search',
  'POST /search/suggest',
  'POST /shares',
  'POST /shares/for-page',
  'POST /spaces',
  'POST /spaces/export',
  'POST /spaces/info',
  'POST /spaces/members',
  'POST /spaces/watch-status',
  'POST /spaces/watched-ids',
  'POST /users/me',
  'POST /version',
  'POST /workspace/entitlements',
  'POST /workspace/info',
  'POST /workspace/invites',
  'POST /workspace/members',
];

describe('read-only API key routes', () => {
  it('match the reviewed list', () => {
    expect(listApiKeyReadRoutes({ dir: '.', excludeDir: 'ee' })).toEqual(
      READ_ROUTES,
    );
  });
});
