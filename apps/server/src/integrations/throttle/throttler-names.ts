export const AUTH_THROTTLER = 'auth';
export const AI_CHAT_THROTTLER = 'ai-chat';
export const OAUTH_REGISTER_THROTTLER = 'oauth-register';
export const OAUTH_TOKEN_THROTTLER = 'oauth-token';
export const OAUTH_AUTHORIZE_THROTTLER = 'oauth-authorize';

// Every named throttler must appear here; spread it in @SkipThrottle and re-enable per name with false.
export const ALL_NAMED_THROTTLERS_SKIPPED: Record<string, boolean> = {
  [AUTH_THROTTLER]: true,
  [AI_CHAT_THROTTLER]: true,
  [OAUTH_REGISTER_THROTTLER]: true,
  [OAUTH_TOKEN_THROTTLER]: true,
  [OAUTH_AUTHORIZE_THROTTLER]: true,
};
