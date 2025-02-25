export enum BillingPlan {
  STANDARD = "standard",
}

export interface IBilling {
  id: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: string;
  quantity: number;
  amount: number;
  interval: string;
  currency: string;
  metadata: Record<string, any>;
  stripePriceId: string;
  stripeItemId: string;
  stripeProductId: string;
  periodStartAt: Date;
  periodEndAt: Date;
  cancelAtPeriodEnd: boolean;
  cancelAt: Date;
  canceledAt: Date;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date;
}

export interface ICheckoutLink {
  url: string;
}

export interface IBillingPortal {
  url: string;
}

export interface IBillingPlan {
  name: string;
  description: string;
  productId: string;
  monthlyId: string;
  yearlyId: string;
  currency: string;
  price: {
    monthly: string;
    yearly: string;
  };
  features: string[];
}
