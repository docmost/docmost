import { Feature } from "@/ee/features";

// Keep in sync with apps/server/src/ee/licence/feature-registry.ts.
const MINIMUM_PLAN: Record<string, { selfHosted: string; cloud: string }> = {
  [Feature.INTEGRATIONS]: { selfHosted: "Business", cloud: "Standard" },
  [Feature.INTEGRATIONS_ADVANCED]: { selfHosted: "Enterprise", cloud: "Business" },
  [Feature.HTML_BLOCKS]: { selfHosted: "Business", cloud: "Standard" },
};

export function getMinimumPlan(
  feature: string | undefined,
  cloud: boolean,
): string | undefined {
  const plan = MINIMUM_PLAN[feature ?? ""];
  if (!plan) return undefined;
  return cloud ? plan.cloud : plan.selfHosted;
}
