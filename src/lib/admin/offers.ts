const urlPattern = /^https:\/\//i;

export class OfferInputError extends Error {
  public constructor(public readonly field: string, message: string) {
    super(message);
    this.name = "OfferInputError";
  }
}

export type OfferInput = { name: string; offerUrl?: string };

export function parseOfferInput(body: unknown): OfferInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new OfferInputError("body", "Request body must be a JSON object.");
  const input = body as Record<string, unknown>;
  if (typeof input.name !== "string" || input.name.trim().length < 1 || input.name.trim().length > 200) throw new OfferInputError("name", "Name must be between 1 and 200 characters.");
  let offerUrl: string | undefined;
  if (input.offerUrl !== undefined && input.offerUrl !== null && input.offerUrl !== "") {
    if (typeof input.offerUrl !== "string" || input.offerUrl.length > 2000 || !urlPattern.test(input.offerUrl.trim())) throw new OfferInputError("offerUrl", "Offer URL must be an HTTPS URL.");
    offerUrl = input.offerUrl.trim();
  }
  return { name: input.name.trim(), offerUrl };
}
