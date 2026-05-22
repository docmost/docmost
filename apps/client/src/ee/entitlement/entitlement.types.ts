export type Tier = "free" | "standard" | "business" | "enterprise";

export type Entitlements = {
  cloud: boolean;
  tier: Tier;
  features: string[];
};
