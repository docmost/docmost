const APP_ROUTE = {
  HOME: "/home",
  SPACES: "/spaces",
  SEARCH: "/search",
  AUTH: {
    LOGIN: "/login",
    SIGNUP: "/signup",
    SETUP: "/setup/register",
    FORGOT_PASSWORD: "/forgot-password",
    PASSWORD_RESET: "/password-reset",
  },
  SETTINGS: {
    ACCOUNT: {
      PROFILE: "/settings/account/profile",
      PREFERENCES: "/settings/account/preferences",
    },
    WORKSPACE: {
      GENERAL: "/settings/workspace",
      MEMBERS: "/settings/members",
      GROUPS: "/settings/groups",
      SPACES: "/settings/spaces",
    },
  },
};

export function getPostLoginRedirect(): string {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect");
  if (redirect) {
    try {
      const resolved = new URL(redirect, window.location.origin);
      if (resolved.origin === window.location.origin) {
        return resolved.pathname + resolved.search + resolved.hash;
      }
    } catch {
      // malformed URL, fall through to default
    }
  }
  return APP_ROUTE.HOME;
}

export default APP_ROUTE;
