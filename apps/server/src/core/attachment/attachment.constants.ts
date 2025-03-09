export enum AttachmentType {
  Avatar = 'avatar',
  WorkspaceLogo = 'workspace-logo',
  SpaceLogo = 'space-logo',
  File = 'file',
  CoverPhoto = 'cover-photo',
}

export const validImageExtensions = ['.jpg', '.png', '.jpeg', '.webp'];
export const MAX_AVATAR_SIZE = '5MB';

export const inlineFileExtensions = [
  '.jpg',
  '.png',
  '.jpeg',
  '.pdf',
  '.mp4',
  '.mov',
];
