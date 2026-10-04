const campaignIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const currencyPattern = /^[A-Z]{3}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export type CostImportRecord = {
  campaignId: string;
  date: string;
  currency: string;
  costMinor: number;
};

export class CostImportInputError extends Error {
  public constructor(
    public readonly field: string,
    message: string,
    public readonly index?: number,
  ) {
    super(message);
    this.name = "CostImportInputError";
  }
}

function error(field: string, message: string, index?: number): never {
  throw new CostImportInputError(field, message, index);
}

function requireString(value: unknown, field: string, maxLength: number, index?: number): string {
  if (typeof value !== "string") {
    return error(field, `${field} must be a string.`, index);
  }

  const result = value.trim();
  if (result.length === 0 || result.length > maxLength) {
    return error(field, `${field} must be between 1 and ${maxLength} characters.`, index);
  }

  return result;
}

function parseDate(value: unknown, index?: number): string {
  const date = requireString(value, "date", 10, index);
  if (!datePattern.test(date)) {
    return error("date", "date must use YYYY-MM-DD format.", index);
  }

  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return error("date", "date must be a valid calendar date.", index);
  }

  return date;
}

function parseRecord(value: unknown, index: number): CostImportRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return error("record", "Each cost import record must be a JSON object.", index);
  }

  const input = value as Record<string, unknown>;
  const campaignId = requireString(input.campaignId, "campaignId", 36, index);
  if (!campaignIdPattern.test(campaignId)) {
    return error("campaignId", "campaignId must be a valid UUID.", index);
  }

  const currency = requireString(input.currency, "currency", 3, index).toUpperCase();
  if (!currencyPattern.test(currency)) {
    return error("currency", "currency must be a three-letter ISO currency code.", index);
  }

  if (
    typeof input.costMinor !== "number" ||
    !Number.isSafeInteger(input.costMinor) ||
    input.costMinor < 0
  ) {
    return error("costMinor", "costMinor must be a safe, non-negative integer.", index);
  }

  return {
    campaignId,
    date: parseDate(input.date, index),
    currency,
    costMinor: input.costMinor,
  };
}

function duplicateKey(record: CostImportRecord): string {
  return `${record.campaignId}\u0000${record.date}\u0000${record.currency}`;
}

/**
 * Validate a provider-neutral daily cost batch before persistence is introduced.
 * A campaign may have at most one record per UTC date and currency in a batch.
 * A zero-cost record is valid and remains distinct from a missing record.
 */
export function parseCostImportRecords(value: unknown): CostImportRecord[] {
  if (!Array.isArray(value)) {
    return error("records", "records must be an array.");
  }

  const records = value.map((record, index) => parseRecord(record, index));
  const seen = new Set<string>();
  records.forEach((record, index) => {
    const key = duplicateKey(record);
    if (seen.has(key)) {
      error("records", "Duplicate daily cost record for campaign, date, and currency.", index);
    }
    seen.add(key);
  });

  return records;
}
