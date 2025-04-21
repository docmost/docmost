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
