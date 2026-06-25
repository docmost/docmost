import { BadRequestException } from '@nestjs/common';

export type MetadataType = 'text' | 'number' | 'boolean' | 'date';

export interface MetadataEntry {
  value: string;
  type: MetadataType;
}

export type PageMetadata = Record<string, MetadataEntry>;

const VALID_TYPES: MetadataType[] = ['text', 'number', 'boolean', 'date'];
const MAX_METADATA_ENTRIES = 50;
const MAX_KEY_LENGTH = 100;
const MAX_TEXT_VALUE_LENGTH = 1000;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate the metadata object. Throws BadRequestException if invalid.
 */
export function validateMetadata(
  metadata: unknown,
): asserts metadata is PageMetadata {
  if (
    typeof metadata !== 'object' ||
    metadata === null ||
    Array.isArray(metadata)
  ) {
    throw new BadRequestException('Metadata must be a JSON object');
  }

  const entries = Object.entries(metadata as Record<string, unknown>);

  if (entries.length > MAX_METADATA_ENTRIES) {
    throw new BadRequestException(
      `Metadata entries must not exceed ${MAX_METADATA_ENTRIES}`,
    );
  }

  for (const [key, entry] of entries) {
    if (typeof key !== 'string' || key.length === 0) {
      throw new BadRequestException('Metadata key cannot be empty');
    }

    if (key.length > MAX_KEY_LENGTH) {
      throw new BadRequestException(
        `Metadata key "${key}" must not exceed ${MAX_KEY_LENGTH} characters`,
      );
    }

    if (typeof entry !== 'object' || entry === null) {
      throw new BadRequestException(
        `Metadata key "${key}" value must be an object`,
      );
    }

    const { value, type } = entry as Record<string, unknown>;

    if (typeof value !== 'string') {
      throw new BadRequestException(
        `Metadata key "${key}" value must be a string`,
      );
    }

    if (!VALID_TYPES.includes(type as MetadataType)) {
      throw new BadRequestException(
        `Metadata key "${key}" type must be one of: ${VALID_TYPES.join(', ')}`,
      );
    }

    switch (type as MetadataType) {
      case 'text':
        if (value.length > MAX_TEXT_VALUE_LENGTH) {
          throw new BadRequestException(
            `Metadata key "${key}" text value must not exceed ${MAX_TEXT_VALUE_LENGTH} characters`,
          );
        }
        break;
      case 'number':
        if (value !== '') {
          const num = Number(value);
          if (isNaN(num) || !isFinite(num)) {
            throw new BadRequestException(
              `Metadata key "${key}" number value is invalid`,
            );
          }
        }
        break;
      case 'boolean':
        if (value !== 'true' && value !== 'false') {
          throw new BadRequestException(
            `Metadata key "${key}" boolean value must be "true" or "false"`,
          );
        }
        break;
      case 'date':
        if (value !== '' && !DATE_REGEX.test(value)) {
          throw new BadRequestException(
            `Metadata key "${key}" date must be in YYYY-MM-DD format`,
          );
        }
        break;
    }
  }
}
