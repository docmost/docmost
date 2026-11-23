import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
} from '@nestjs/common';
import { MAX_BODY_DEPTH } from '../decorators/max-body-depth.decorator';

// Must precede ValidationPipe: its prototype stripping and class-transformer
// both recurse into raw values, including fields later removed by whitelist.
export class BodyDepthValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const maxDepth: number | undefined =
      metadata.type === 'body' && metadata.metatype
        ? Reflect.getMetadata(MAX_BODY_DEPTH, metadata.metatype)
        : undefined;
    if (maxDepth === undefined || value === null || typeof value !== 'object') {
      return value;
    }

    // Count object/array containers, including the body itself. Width remains
    // governed by the HTTP body-size limit and the DTO's existing validators.
    const pending: { value: object; depth: number }[] = [{ value, depth: 1 }];
    while (pending.length) {
      const current = pending.pop()!;
      if (current.depth > maxDepth) {
        throw new BadRequestException('Request body is nested too deeply');
      }
      for (const child of Object.values(current.value)) {
        if (child !== null && typeof child === 'object') {
          pending.push({ value: child, depth: current.depth + 1 });
        }
      }
    }

    return value;
  }
}
