export interface IBilling {
  id: string;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
  // TODO: populate
}

export interface ICheckoutLink {
  url: string
}

export interface IBillingPortal {
  url: string
}