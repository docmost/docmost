/** How a group membership came to exist. Stored on `group_users.source`. */
export const MembershipSource = {
  MANUAL: 'manual',
  GOOGLE: 'google',
} as const;

export type MembershipSourceType =
  (typeof MembershipSource)[keyof typeof MembershipSource];
