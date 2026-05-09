// MIT - https://github.com/typestack/class-validator/pull/2626
import isISO6391Validator from 'validator/lib/isISO6391';
import { buildMessage, ValidateBy, ValidationOptions } from 'class-validator';

export const IS_ISO6391 = 'isISO6391';

/**
 * Check if the string is a valid [ISO 639-1](https://en.wikipedia.org/wiki/ISO_639-1) officially assigned language code.
 */
export function isISO6391(value: unknown): boolean {
  return typeof value === 'string' && isISO6391Validator(value);
}

/**
 * Check if the string is a valid [ISO 639-1](https://en.wikipedia.org/wiki/ISO_639-1) officially assigned language code.
 */
export function IsISO6391(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: IS_ISO6391,
      validator: {
        validate: (value, args): boolean => isISO6391(value),
        defaultMessage: buildMessage(
          (eachPrefix) =>
            eachPrefix + '$property must be a valid ISO 639-1 language code',
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}
