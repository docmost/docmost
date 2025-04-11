export interface ICreateShare {
  slugId: string; // share slugId
  pageId: string;
  includeSubPages?: boolean;
}

export interface IShareInfoInput {
  shareId: string;
  pageId: string;
}
