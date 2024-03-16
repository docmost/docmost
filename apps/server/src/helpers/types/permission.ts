export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin', // can have owner permissions but cannot delete workspace
  MEMBER = 'member',
}

export enum SpaceRole {
  OWNER = 'owner', // can add members, remove, and delete space
  WRITER = 'writer', // can read and write pages in space
  READER = 'reader', // can only read pages in space
}

export enum SpacePrivacy {
  OPEN = 'open', // any workspace member can see and join.
  PRIVATE = 'private', // only added space users can see
}
