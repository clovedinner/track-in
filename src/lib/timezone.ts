export const DEFAULT_TIMEZONE = "UTC";

export function isValidTimezone(value: string): boolean {
  if (value === "UTC") return true;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function formatDateInTimezone(value: Date | string, timezone: string, includeTimezone = true): string {
  const label = includeTimezone ? ` (${timezone})` : "";
  return `${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE }).format(new Date(value))}${label}`;
}
