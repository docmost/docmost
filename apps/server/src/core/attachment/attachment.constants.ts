export enum AttachmentType {
  Avatar = 'avatar',
  WorkspaceIcon = 'workspace-icon',
  SpaceIcon = 'space-icon',
  File = 'file',
}

export const validImageExtensions = ['.jpg', '.png', '.jpeg', '.webp'];
export const MAX_AVATAR_SIZE = '10MB';
export const MAX_AVATAR_SIZE_BYTES = 10 * 1024 * 1024;

export const inlineFileExtensions = [
  '.jpg',
  '.png',
  '.jpeg',
  '.pdf',
  '.mp4',
  '.mov',
];
