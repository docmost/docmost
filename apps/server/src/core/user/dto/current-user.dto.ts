export interface CurrentUserDto {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    timezone: string;
    avatarUrl: string;
    workspaceId: string;
  };

  workspace: {
    id: string;
    name: string;
    description: string;
    logo: string;
    oidcEnabled: boolean;
    oidcButtonName: string;
  };
}
