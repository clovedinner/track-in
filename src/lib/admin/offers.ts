const urlPattern = /^https:\/\//i;

export class OfferInputError extends Error {
  public constructor(public readonly field: string, message: string) {
    super(message);
    this.name = "OfferInputError";
  }
}

export type OfferInput = { name: string; s2sPostbackUrl?: string };

export function parseOfferInput(body: unknown): OfferInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new OfferInputError("body", "Request body must be a JSON object.");
  const input = body as Record<string, unknown>;
  if (typeof input.name !== "string" || input.name.trim().length < 1 || input.name.trim().length > 200) throw new OfferInputError("name", "Name must be between 1 and 200 characters.");
  let s2sPostbackUrl: string | undefined;
  if (input.s2sPostbackUrl !== undefined && input.s2sPostbackUrl !== null && input.s2sPostbackUrl !== "") {
    if (typeof input.s2sPostbackUrl !== "string" || input.s2sPostbackUrl.length > 2000 || !urlPattern.test(input.s2sPostbackUrl.trim())) throw new OfferInputError("s2sPostbackUrl", "S2S postback URL must be an HTTPS URL.");
    s2sPostbackUrl = input.s2sPostbackUrl.trim();
  }
  return { name: input.name.trim(), s2sPostbackUrl };
}
