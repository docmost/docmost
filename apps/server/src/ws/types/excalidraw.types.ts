export type ExcalidrawUserToFollow = {
  socketId: string;
  username: string;
};

export type ExcalidrawFollowPayload = {
  userToFollow: ExcalidrawUserToFollow;
  action: 'FOLLOW' | 'UNFOLLOW';
};
