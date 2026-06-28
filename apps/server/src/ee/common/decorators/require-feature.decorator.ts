import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { FeatureKey } from '../../../common/features';
import { FeatureGateGuard } from '../guards/feature-gate.guard';

export const REQUIRED_FEATURE_KEY = 'required_feature';

export function RequireFeature(feature: FeatureKey) {
  return applyDecorators(
    UseGuards(FeatureGateGuard),
    SetMetadata(REQUIRED_FEATURE_KEY, feature),
  );
}
