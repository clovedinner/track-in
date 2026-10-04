/**
 * Voluum-compatible Google Tag Manager snippets.
 *
 * The generated values deliberately use GTM variable placeholders. They are
 * not credentials and must be resolved by GTM at event time. Keep this module
 * pure so the setup UI can render and copy snippets without database access.
 */

export type GtmSnippetEvent = {
  /** Human-readable name shown next to the generated snippet. */
  label: string;
  /** Value sent as the Voluum-compatible `et` parameter. */
  eventType: string;
  /** Optional GTM variable for a unique later transaction. */
  txidVariable?: string;
  /** Optional GTM variable for payout/value. */
  payoutVariable?: string;
  /** Optional GTM variable for the payout currency. */
  currencyVariable?: string;
};

export type GtmSnippetOptions = {
  /** Public tracker origin or base URL, for example https://tracker.example. */
  trackerBaseUrl: string;
  /** GTM variable containing the tracker `cid`, defaulting to {{ClickID}}. */
  cidVariable?: string;
  /** Events to generate, normally registration and FTD. */
  events?: readonly GtmSnippetEvent[];
};

export type GtmSnippet = {
  label: string;
  eventType: string;
  imageUrl: string;
  /** Paste this into a GTM Custom HTML tag. */
  html: string;
};

export type GtmSnippetSet = {
  postbackPath: "/postback";
  cidVariable: string;
  snippets: GtmSnippet[];
};

export const DEFAULT_GTM_EVENTS: readonly GtmSnippetEvent[] = [
  { label: "Registration", eventType: "reg" },
  { label: "First-time deposit (FTD)", eventType: "ftd" },
];

function requireHttpUrl(value: string): URL {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Tracker base URL is required.");
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Tracker base URL must be a valid URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Tracker base URL must use HTTP or HTTPS.");
  }
  url.search = "";
  url.hash = "";
  return url;
}

function requirePlaceholder(value: string, name: string): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 256) {
    throw new Error(`${name} must be a non-empty GTM variable.`);
  }
  return normalized;
}

function requireEventType(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(normalized)) {
    throw new Error("GTM event type must contain only letters, numbers, underscores, or hyphens.");
  }
  return normalized;
}

/**
 * Encode a query value while preserving an exact GTM placeholder. Leaving the
 * placeholder visible is important: GTM substitutes `{{Variable}}` before the
 * image request is made. All non-placeholder input is URI encoded.
 */
function encodeQueryValue(value: string): string {
  if (/^\{\{[^{}]{1,240}\}\}$/.test(value)) return value;
  return encodeURIComponent(value);
}

function appendParameter(parts: string[], key: string, value: string | undefined): void {
  if (value === undefined) return;
  parts.push(`${key}=${encodeQueryValue(value)}`);
}

function buildImageUrl(baseUrl: URL, cidVariable: string, event: GtmSnippetEvent): string {
  const url = new URL("postback", baseUrl);
  const parts: string[] = [];
  appendParameter(parts, "cid", cidVariable);
  appendParameter(parts, "et", requireEventType(event.eventType));
  appendParameter(parts, "txid", event.txidVariable === undefined ? undefined : requirePlaceholder(event.txidVariable, "txidVariable"));
  appendParameter(parts, "payout", event.payoutVariable === undefined ? undefined : requirePlaceholder(event.payoutVariable, "payoutVariable"));
  appendParameter(parts, "currency", event.currencyVariable === undefined ? undefined : requirePlaceholder(event.currencyVariable, "currencyVariable"));
  url.search = parts.join("&");
  return url.toString();
}

export function generateGtmSnippets(options: GtmSnippetOptions): GtmSnippetSet {
  const baseUrl = requireHttpUrl(options.trackerBaseUrl);
  const cidVariable = requirePlaceholder(options.cidVariable ?? "{{ClickID}}", "cidVariable");
  const events = options.events ?? DEFAULT_GTM_EVENTS;
  if (events.length === 0) throw new Error("At least one GTM event is required.");

  const snippets = events.map((event) => {
    const eventType = requireEventType(event.eventType);
    const label = event.label.trim();
    if (label.length === 0 || label.length > 100) throw new Error("GTM event label must be non-empty and no longer than 100 characters.");
    const imageUrl = buildImageUrl(baseUrl, cidVariable, { ...event, eventType });
    const escapedUrl = imageUrl.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
    return {
      label,
      eventType,
      imageUrl,
      html: `<img src="${escapedUrl}" width="1" height="1" alt="" style="display:none" />`,
    };
  });

  return { postbackPath: "/postback", cidVariable, snippets };
}

export function generateDefaultGtmSnippets(trackerBaseUrl: string, cidVariable = "{{ClickID}}"): GtmSnippetSet {
  return generateGtmSnippets({ trackerBaseUrl, cidVariable });
}
