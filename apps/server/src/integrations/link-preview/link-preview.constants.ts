export const LINK_PREVIEW_MAX_REDIRECTS = 5;
export const LINK_PREVIEW_TIMEOUT_MS = 8_000;
export const LINK_PREVIEW_DNS_TIMEOUT_MS = 2_000;
export const LINK_PREVIEW_MAX_BYTES = 1024 * 1024;
export const LINK_PREVIEW_TITLE_MAX_LENGTH = 300;
export const LINK_PREVIEW_DESCRIPTION_MAX_LENGTH = 500;
export const LINK_PREVIEW_URL_MAX_LENGTH = 2048;
export const LINK_PREVIEW_SECTION_TITLE_MAX_LENGTH = 100;
export const LINK_PREVIEW_MIN_IMAGE_SIZE = 100;
export const LINK_PREVIEW_OEMBED_MAX_BYTES = 64 * 1024;

export const LINK_PREVIEW_CACHE_PREFIX = 'link-preview:';
export const LINK_PREVIEW_CACHE_TTL = 3600;
export const LINK_PREVIEW_ERROR_CACHE_TTL = 300;

export const LINK_PREVIEW_ACCEPT =
  'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8';
export const LINK_PREVIEW_OEMBED_ACCEPT = 'application/json';
// Fixed for everyone: no user setting is sent to other sites.
export const LINK_PREVIEW_ACCEPT_LANGUAGE = 'en';
export const LINK_PREVIEW_USER_AGENT = 'DocmostBot-LinkPreview (+https://docmost.com/robots)';

export const LINK_PREVIEW_FETCH = 'LINK_PREVIEW_FETCH';

export const LINK_PREVIEW_SIGN_IN_HOSTS = [
  'accounts.google.com',
  'login.microsoftonline.com',
  'login.live.com',
  'login.windows.net',
  'id.atlassian.com',
];

export const LINK_PREVIEW_SIGN_IN_HOST_SUFFIXES = [
  '.okta.com',
  '.oktapreview.com',
  '.auth0.com',
  '.onelogin.com',
];

export const LINK_PREVIEW_SIGN_IN_PATH_SEGMENTS = [
  'login',
  'log-in',
  'signin',
  'sign-in',
  'sign_in',
  'signon',
  'auth',
  'authorize',
  'oauth',
  'oauth2',
  'saml',
  'saml2',
  'sso',
  'servicelogin',
  'adfs',
];

// Asked before the page: NYT refuses the page, YouTube may answer with a consent page.
export const LINK_PREVIEW_OEMBED_PROVIDERS = [
  { hosts: ['youtube.com', 'youtu.be'], endpoint: 'https://www.youtube.com/oembed' },
  { hosts: ['vimeo.com'], endpoint: 'https://vimeo.com/api/oembed.json' },
  { hosts: ['nytimes.com'], endpoint: 'https://www.nytimes.com/svc/oembed/json/' },
];
