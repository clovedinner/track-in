export const MAX_CUSTOM_CONVERSIONS = 20;
const MAX_EVENT_VALUES = 30;

export class CustomConversionInputError extends Error {
  constructor(public readonly field: string, message: string) {
    super(message);
    this.name = "CustomConversionInputError";
  }
}

export type CustomConversionInput = {
  name: string;
  eventValues: string[];
  includeInConversions: boolean;
  includeInRevenue: boolean;
  sendPostbackToTrafficSource: boolean;
  includeInCost: boolean;
};

function readBoolean(record: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = record[key];
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new CustomConversionInputError(key, "must be true or false");
  return value;
}

export function parseCustomConversionInput(value: unknown): CustomConversionInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CustomConversionInputError("body", "must be an object");
  }
  const record = value as Record<string, unknown>;
  if (typeof record.name !== "string") throw new CustomConversionInputError("name", "is required");
  const name = record.name.trim();
  if (!name || name.length > 100) throw new CustomConversionInputError("name", "must be between 1 and 100 characters");

  const rawValues = record.eventValues;
  const values = typeof rawValues === "string" ? rawValues.split(/[\r\n,]+/) : rawValues;
  if (!Array.isArray(values) || values.some((item) => typeof item !== "string")) {
    throw new CustomConversionInputError("eventValues", "must be a list of event values");
  }
  const eventValues = [...new Set(values.map((item) => item.trim().toLowerCase()).filter(Boolean))];
  if (eventValues.length === 0) throw new CustomConversionInputError("eventValues", "add at least one accepted event value");
  if (eventValues.length > MAX_EVENT_VALUES) throw new CustomConversionInputError("eventValues", `use no more than ${MAX_EVENT_VALUES} values`);
  if (eventValues.some((item) => item.length > 80 || /[\u0000-\u001f]/.test(item))) {
    throw new CustomConversionInputError("eventValues", "each value must be 80 characters or fewer");
  }

  return {
    name,
    eventValues,
    includeInConversions: readBoolean(record, "includeInConversions", true),
    includeInRevenue: readBoolean(record, "includeInRevenue", false),
    sendPostbackToTrafficSource: readBoolean(record, "sendPostbackToTrafficSource", false),
    includeInCost: readBoolean(record, "includeInCost", false),
  };
}
