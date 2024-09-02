export enum AttachmentType {
  Avatar = 'avatar',
  WorkspaceLogo = 'workspace-logo',
  SpaceLogo = 'space-logo',
  File = 'file',
}

export const validImageExtensions = ['.jpg', '.png', '.jpeg'];
export const MAX_AVATAR_SIZE = '5MB';

export const inlineFileExtensions = [
  '.jpg',
  '.png',
  '.jpeg',
  '.pdf',
  '.mp4',
  '.mov',
];
export const MAX_FILE_SIZE = '50MB';
