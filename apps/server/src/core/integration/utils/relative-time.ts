import { formatDistanceStrict } from 'date-fns';

export function relativeTime(iso: string): string {
  return formatDistanceStrict(new Date(iso), new Date(), { addSuffix: true });
}
