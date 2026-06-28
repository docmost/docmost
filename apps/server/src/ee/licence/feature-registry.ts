import { Feature } from '../../common/features';

const ALL_FEATURES = new Set(Object.values(Feature));

const CLOUD_PLAN_FEATURES: Record<string, Set<string>> = {
  standard: ALL_FEATURES,
  business: ALL_FEATURES,
  enterprise: ALL_FEATURES,
};

export function getFeaturesForCloudPlan(plan?: string): Set<string> {
  return CLOUD_PLAN_FEATURES[plan ?? 'standard'] ?? ALL_FEATURES;
}
