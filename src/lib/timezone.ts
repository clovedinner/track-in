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

export function parseDateInTimezone(value: string | undefined, timezone: string, endOfDay = false): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !isValidTimezone(timezone)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const candidate = Date.UTC(year, month - 1, day + (endOfDay ? 1 : 0));
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(candidate));
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  const displayedAsUtc = Date.UTC(values.year, values.month - 1, values.day, values.hour === 24 ? 0 : values.hour, values.minute, values.second);
  return new Date(candidate - (displayedAsUtc - candidate));
}
