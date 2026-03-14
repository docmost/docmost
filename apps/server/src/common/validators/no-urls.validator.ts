import { registerDecorator, ValidationOptions } from 'class-validator';
import * as tlds from 'tlds';

const URL_PATTERN = /https?:\/\//i;
const tldSet = new Set(tlds.map((t) => t.toLowerCase()));

export function containsDomain(value: string): boolean {
  const tokens = value.split(/\s+/);
  for (const token of tokens) {
    if (token.includes('@')) continue;
    const segments = token.split('.');
    for (let i = 1; i < segments.length; i++) {
      const suffix = segments[i].replace(/[^\w].*/g, '');
      if (segments[i - 1] && suffix && tldSet.has(suffix.toLowerCase())) {
        return true;
      }
    }
  }
  return false;
}

export function NoUrls(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'noUrls',
      target: object.constructor,
      propertyName,
      options: {
        message: 'Must not contain URLs or domain names',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return true;
          if (URL_PATTERN.test(value)) return false;
          if (containsDomain(value)) return false;
          return true;
        },
      },
    });
  };
}
