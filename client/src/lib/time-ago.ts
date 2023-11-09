import { formatDistanceStrict } from 'date-fns';

export function timeAgo(date: Date){
  return formatDistanceStrict(new Date(date), new Date(), { addSuffix: true })
}
