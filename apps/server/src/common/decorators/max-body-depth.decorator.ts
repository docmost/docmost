import { SetMetadata } from '@nestjs/common';

export const MAX_BODY_DEPTH = Symbol('maxBodyDepth');

// Opt in per DTO. Metadata is inherited by DTO subclasses.
export const MaxBodyDepth = (depth: number) =>
  SetMetadata(MAX_BODY_DEPTH, depth);
