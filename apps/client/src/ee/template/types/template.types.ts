export interface ITemplate {
  id: string;
  title: string;
  description?: string;
  content?: any;
  icon?: string;
  spaceId?: string;
  workspaceId: string;
  creatorId: string;
  lastUpdatedById?: string;
  creator?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  createdAt: string;
  updatedAt: string;
}
