import { Feature } from '../../common/features';

export const ALL_EE_FEATURES = Object.freeze(Object.values(Feature));

export function getFeaturesForCloudPlan(plan?: string): Set<string> {
  if (!plan || plan === 'free') {
    return new Set<string>();
  }

  return new Set(ALL_EE_FEATURES);
}

