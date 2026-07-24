import { registerDecorator, ValidationOptions } from 'class-validator';

const MIN_DUE_DATE = new Date('2000-01-01T00:00:00.000Z');
const MAX_FUTURE_YEARS = 5;

function maxDueDate(): Date {
  const max = new Date();
  max.setFullYear(max.getFullYear() + MAX_FUTURE_YEARS);
  return max;
}

/**
 * Accepts null/undefined (field is optional). Rejects unparseable dates,
 * dates before 2000-01-01, and dates more than 5 years in the future.
 */
export function IsDueDateInRange(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isDueDateInRange',
      target: object.constructor,
      propertyName,
      options: {
        message: `dueDate must be between ${MIN_DUE_DATE.getUTCFullYear()} and ${MAX_FUTURE_YEARS} years from now`,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          if (value === null || value === undefined) return true;
          if (typeof value !== 'string') return false;
          const date = new Date(value);
          if (Number.isNaN(date.getTime())) return false;
          return date >= MIN_DUE_DATE && date <= maxDueDate();
        },
      },
    });
  };
}
