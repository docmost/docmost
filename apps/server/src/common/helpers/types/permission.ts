export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin', // can have owner permissions but cannot delete workspace
  MEMBER = 'member',
}

export enum SpaceRole {
  ADMIN = 'admin', // can manage space settings, members, and delete space
  WRITER = 'writer', // can read and write pages in space
  READER = 'reader', // can only read pages in space
}

export enum SpaceVisibility {
  OPEN = 'open', // any workspace member can see that it exists and join.
  PRIVATE = 'private', // only added space users can see
}

export enum PageAccessLevel {
  RESTRICTED = 'restricted', // only specific users/groups can view or edit
}

export enum PagePermissionRole {
  READER = 'reader', // can only view content and descendants
  WRITER = 'writer', // can edit content, descendants, and add new users to permission
}
