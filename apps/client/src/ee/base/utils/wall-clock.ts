import { instantToWall, wallToInstant } from "@docmost/base-formula/client";

const WALL_STRING = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/;

const pad = (n: number) => String(n).padStart(2, "0");

export function toWallString(instant: string, timeZone: string): string {
  const wall = instantToWall(instant, timeZone);
  return `${wall.ymd} ${pad(wall.hour)}:${pad(wall.minute)}:${pad(wall.second)}`;
}

export function fromWallString(value: string, timeZone: string): string {
  const match = WALL_STRING.exec(value);
  if (!match) throw new RangeError("Invalid wall-clock time: " + value);
  return wallToInstant(
    {
      ymd: match[1],
      hour: Number(match[2]),
      minute: Number(match[3]),
      second: match[4] === undefined ? 0 : Number(match[4]),
      millisecond: 0,
    },
    timeZone,
  );
}
