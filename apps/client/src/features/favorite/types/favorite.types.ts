export type FavoriteType = "page" | "space" | "template";

export type IFavorite = {
  id: string;
  userId: string;
  pageId: string | null;
  spaceId: string | null;
  templateId: string | null;
  type: FavoriteType;
  workspaceId: string;
  createdAt: string;
  page?: {
    id: string;
    slugId: string;
    title: string;
    icon: string | null;
    spaceId: string;
  };
  space?: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
  };
  template?: {
    id: string;
    title: string;
    description: string | null;
    icon: string | null;
    spaceId: string | null;
  };
};
