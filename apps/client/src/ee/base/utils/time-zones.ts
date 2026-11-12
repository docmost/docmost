export function timeZoneName(timeZone: string): string {
  return timeZone.replaceAll("_", " ");
}

export function listTimeZones(current: string | null | undefined): string[] {
  const intl = Intl as typeof Intl & {
    supportedValuesOf?: (key: "timeZone") => string[];
  };
  let supported: string[] = [];
  try {
    supported = intl.supportedValuesOf?.("timeZone") ?? [];
  } catch {
    // runtimes without the zone list still offer UTC and the stored zone
  }
  const zones = ["UTC", ...supported.filter((zone) => zone !== "UTC")];
  if (current && !zones.includes(current)) zones.push(current);
  return zones;
}
