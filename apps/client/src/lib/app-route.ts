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
    CREATE_WORKSPACE: "/create",
    SELECT_WORKSPACE: "/select",
    MFA_CHALLENGE: "/login/mfa",
    MFA_SETUP_REQUIRED: "/login/mfa/setup",
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

export default APP_ROUTE;
