export enum JwtType {
  ACCESS = 'access',
  COLLAB = 'collab',
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
