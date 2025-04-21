import { SetMetadata } from '@nestjs/common';

export const SKIP_TRANSFORM_KEY = 'SKIP_TRANSFORM';
export const SkipTransform = () => SetMetadata(SKIP_TRANSFORM_KEY, true);
