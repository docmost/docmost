export function formatUserLocalTime(
  timezone: string,
  now: Date,
  language: string,
): string | null {
  try {
    return new Intl.DateTimeFormat(language, {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(now);
  } catch {
    return null;
  }
}

export function getTimezoneCity(timezone: string): string {
  return timezone.split("/").pop().replace(/_/g, " ");
}
