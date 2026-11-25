export const CALLOUT_TYPES = [
  'default',
  'info',
  'note',
  'success',
  'warning',
  'danger',
] as const;

export type CalloutType = (typeof CALLOUT_TYPES)[number];

export function getValidCalloutType(value: string): string {
  if (value) {
    return CALLOUT_TYPES.some((type) => type === value) ? value : 'info';
  }
}
