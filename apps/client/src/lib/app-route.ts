const APP_ROUTE = {
  HOME: "/home",
  SPACES: "/spaces",
  FAVORITES: "/favorites",
  SEARCH: "/search",
  AUTH: {
    LOGIN: "/login",
    SIGNUP: "/signup",
    SETUP: "/setup/register",
    FORGOT_PASSWORD: "/forgot-password",
    PASSWORD_RESET: "/password-reset",
    CREATE_WORKSPACE: "/create",
    SELECT_WORKSPACE: "/select",
    MFA_CHALLENGE: "/login/mfa",
    MFA_SETUP_REQUIRED: "/login/mfa/setup",
    VERIFY_EMAIL: "/verify-email",
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
      BILLING: "/settings/billing",
      SECURITY: "/settings/security",
    },
  },
};

export function safeRedirectPath(input: unknown): string | null {
  if (typeof input !== "string") return null;
  if (input.length === 0 || input.length > 2048) return null;
  // Reject whitespace, backslash, and any Unicode "Other" category char
  // (ASCII controls, zero-width space, BOM, bidi marks, etc).
  if (/[\s\\]|\p{C}/u.test(input)) return null;
  if (!input.startsWith("/") || input.startsWith("//")) return null;
  if (input.toLowerCase().includes("://")) return null;
  if (/^\/[a-z][a-z0-9+\-.]*:/i.test(input)) return null;
  try {
    const resolved = new URL(input, window.location.origin);
    if (resolved.origin !== window.location.origin) return null;
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return null;
  }
}

export function getPostLoginRedirect(): string {
  const params = new URLSearchParams(window.location.search);
  return safeRedirectPath(params.get("redirect")) ?? APP_ROUTE.HOME;
}

/**
 * Returns the `?redirect=` value from the current URL only when it is a safe
 * same-origin path. Unlike {@link getPostLoginRedirect} this returns `null`
 * (not `/home`) when no redirect is present, so callers can distinguish
 * "user came here directly" from "user was bounced from a deep link".
 */
export function getRedirectParam(): string | null {
  const params = new URLSearchParams(window.location.search);
  return safeRedirectPath(params.get("redirect"));
}

export default APP_ROUTE;
