import { instantToWall, isValidTimeZone } from "@docmost/base-formula/client";

const HALF_YEAR_MS = 182 * 86_400_000;

export function getViewerTimeZone(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidTimeZone(zone) ? zone : "UTC";
}

export function isSameTimeZone(a: string, b: string, now: Date): boolean {
  if (a === b) return true;
  if (!isValidTimeZone(a) || !isValidTimeZone(b)) return false;
  return [now.getTime(), now.getTime() + HALF_YEAR_MS].every((ms) => {
    const instant = new Date(ms).toISOString();
    const wallA = instantToWall(instant, a);
    const wallB = instantToWall(instant, b);
    return (
      wallA.ymd === wallB.ymd &&
      wallA.hour === wallB.hour &&
      wallA.minute === wallB.minute &&
      wallA.second === wallB.second &&
      wallA.millisecond === wallB.millisecond
    );
  });
}
