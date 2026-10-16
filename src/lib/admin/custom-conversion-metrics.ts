export type CustomConversionColumn = {
  id: string;
  name: string;
  eventValues: string[];
  includeInConversions: boolean;
};

export type EventTypeRecord = { eventType: string };

export function normalizeEventType(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

export function getCustomConversionCounts(
  conversions: readonly EventTypeRecord[],
  definitions: readonly CustomConversionColumn[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const definition of definitions) {
    if (!definition.includeInConversions) continue;
    const eventValues = new Set(definition.eventValues.map(normalizeEventType).filter(Boolean));
    counts[definition.id] = conversions.reduce(
      (count, conversion) => count + (eventValues.has(normalizeEventType(conversion.eventType)) ? 1 : 0),
      0,
    );
  }
  return counts;
}

export function includedCustomConversionColumns(definitions: readonly CustomConversionColumn[]): CustomConversionColumn[] {
  return definitions.filter((definition) => definition.includeInConversions);
}
