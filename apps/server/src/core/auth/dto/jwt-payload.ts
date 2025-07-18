export enum JwtType {
  ACCESS = 'access',
  COLLAB = 'collab',
  EXCHANGE = 'exchange',
  ATTACHMENT = 'attachment',
}
export type JwtPayload = {
  sub: string;
  email: string;
  workspaceId: string;
  type: 'access';
};

export type JwtCollabPayload = {
  sub: string;
  workspaceId: string;
  type: 'collab';
};

export type JwtExchangePayload = {
  sub: string;
  workspaceId: string;
  type: 'exchange';
};

export type JwtAttachmentPayload = {
  attachmentId: string;
  pageId: string;
  workspaceId: string;
  type: 'attachment';
};

