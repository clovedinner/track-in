import { NextResponse } from "next/server";

import { GET as listCampaigns, POST as createCampaign } from "@/app/api/admin/campaigns/route";
import { PATCH as updateCampaign } from "@/app/api/admin/campaigns/[campaignId]/route";
import { POST as testCampaign } from "@/app/api/admin/campaigns/[campaignId]/setup-test/route";
import { GET as listOffers, POST as createOffer } from "@/app/api/admin/offers/route";
import { PATCH as updateOffer } from "@/app/api/admin/offers/[offerId]/route";
import { GET as listTrafficSources, POST as createTrafficSource } from "@/app/api/admin/traffic-sources/route";
import { PUT as updateTrafficSource } from "@/app/api/admin/traffic-sources/[id]/route";
import { GET as listCustomConversions, POST as createCustomConversion } from "@/app/api/admin/custom-conversions/route";
import { PATCH as updateCustomConversion, DELETE as deleteCustomConversion } from "@/app/api/admin/custom-conversions/[id]/route";
import { GET as deliveryHealth } from "@/app/api/admin/delivery-health/route";
import { POST as retryDelivery } from "@/app/api/admin/delivery-health/[id]/retry/route";
import { PATCH as updateTimezone } from "@/app/api/admin/profile/timezone/route";
import { authenticateApiToken, type ApiScope } from "@/lib/api/keys";
import { runWithApiKeyPrincipal } from "@/lib/api/v1-context";
import { getCorrelationId } from "@/lib/observability/correlation-id";
import { prisma } from "@/lib/database/prisma";
import { getCampaignDetail } from "@/lib/admin/campaign-views";
import { getOverviewMetrics } from "@/lib/metrics/queries";
import { parseDateInTimezone } from "@/lib/timezone";
import { logger } from "@/lib/observability/logger";
import { Prisma } from "@/generated/prisma/client";
import { getConversionPostbackDestination, hashConversionPayload, isSetupTestClick, MAX_CONVERSION_BODY_BYTES, MONEY_SITE_SOURCE, parseConversionPayload } from "@/lib/conversions/intake";
import { safeTrafficSourceConfiguration } from "@/lib/admin/traffic-sources";
import { sanitizeDiagnostic } from "@/lib/admin/delivery-health";

type Handler = (request: Request, params: Record<string, string>) => Promise<Response>;
type Route = { scope: ApiScope; handler: Handler; params?: string[] };

const rateWindowMs = 60_000;
const maxRequestsPerWindow = 120;
const requestWindows = new Map<string, { startedAt: number; count: number }>();

function overRateLimit(keyId: string): boolean {
  const now = Date.now();
  const current = requestWindows.get(keyId);
  if (!current || now - current.startedAt >= rateWindowMs) {
    requestWindows.set(keyId, { startedAt: now, count: 1 });
    if (requestWindows.size > 1000) {
      for (const [id, window] of requestWindows) if (now - window.startedAt >= rateWindowMs) requestWindows.delete(id);
    }
    return false;
  }
  current.count += 1;
  return current.count > maxRequestsPerWindow;
}

function withParam<T extends Record<string, string>>(
  handler: (request: Request, context: { params: Promise<T> }) => Promise<Response>,
  names: readonly (keyof T)[],
): Handler {
  return (request, params) => {
    const selected = Object.fromEntries(names.map((name) => [name, params[String(name)]])) as T;
    return handler(request, { params: Promise.resolve(selected) });
  };
}

const methodRoutes: Record<string, Route> = {
  "GET campaigns": { scope: "campaigns:read", handler: listCampaigns },
  "POST campaigns": { scope: "campaigns:write", handler: createCampaign },
  "PATCH campaigns/:campaignId": { scope: "campaigns:write", handler: withParam(updateCampaign, ["campaignId"]), params: ["campaignId"] },
  "POST campaigns/:campaignId/setup-test": { scope: "campaigns:write", handler: withParam(testCampaign, ["campaignId"]), params: ["campaignId"] },
  "GET offers": { scope: "offers:read", handler: listOffers },
  "POST offers": { scope: "offers:write", handler: createOffer },
  "PATCH offers/:offerId": { scope: "offers:write", handler: withParam(updateOffer, ["offerId"]), params: ["offerId"] },
  "GET traffic-sources": { scope: "traffic_sources:read", handler: listTrafficSources },
  "POST traffic-sources": { scope: "traffic_sources:write", handler: createTrafficSource },
  "PUT traffic-sources/:id": { scope: "traffic_sources:write", handler: withParam(updateTrafficSource, ["id"]), params: ["id"] },
  "GET custom-conversions": { scope: "conversions:read", handler: listCustomConversions },
  "POST custom-conversions": { scope: "conversions:write", handler: createCustomConversion },
  "PATCH custom-conversions/:id": { scope: "conversions:write", handler: withParam(updateCustomConversion, ["id"]), params: ["id"] },
  "DELETE custom-conversions/:id": { scope: "conversions:write", handler: withParam(deleteCustomConversion, ["id"]), params: ["id"] },
  "GET delivery-health": { scope: "delivery:read", handler: deliveryHealth },
  "POST delivery-health/:id/retry": { scope: "delivery:retry", handler: withParam(retryDelivery, ["id"]), params: ["id"] },
  "PATCH profile/timezone": { scope: "profile:write", handler: updateTimezone },
};

function resolveRoute(method: string, path: string[]): { route: Route; params: Record<string, string> } | null {
  const key = `${method} ${path.join("/")}`;
  if (methodRoutes[key]) return { route: methodRoutes[key], params: {} };
  for (const [template, route] of Object.entries(methodRoutes)) {
    const [candidateMethod, ...segments] = template.split(" ").flatMap((part, index) => index === 0 ? [part] : part.split("/"));
    if (candidateMethod !== method || segments.length !== path.length || !route.params) continue;
    const params: Record<string, string> = {};
    let matched = true;
    segments.forEach((segment, index) => {
      const parameter = /^:(.+)$/.exec(segment);
      if (parameter) {
        try { params[parameter[1]] = decodeURIComponent(path[index]); }
        catch { matched = false; }
      } else if (segment !== path[index]) matched = false;
    });
    if (matched) return { route, params };
  }
  return null;
}

async function handle(request: Request, path: string[]) {
  const requestId = getCorrelationId(request);
  const authenticated = await authenticateApiToken(request);
  if (!authenticated) return NextResponse.json({ error: { code: "unauthorized", message: "A valid API key is required.", request_id: requestId } }, { status: 401, headers: { "x-request-id": requestId } });
  if (overRateLimit(authenticated.keyId)) return NextResponse.json({ error: { code: "rate_limited", message: "Request limit exceeded. Try again shortly.", request_id: requestId } }, { status: 429, headers: { "x-request-id": requestId, "retry-after": "60" } });

  if (path.length === 1 && path[0] === "me" && request.method === "GET") {
    if (!authenticated.scopes.includes("profile:read")) return NextResponse.json({ error: { code: "forbidden", message: "The API key does not have profile:read access.", request_id: requestId } }, { status: 403, headers: { "x-request-id": requestId } });
    return NextResponse.json({ id: authenticated.principal.id, email: authenticated.principal.email, timezone: authenticated.principal.timezone }, { headers: { "x-request-id": requestId } });
  }

  if (path.length === 1 && path[0] === "conversions" && request.method === "POST") {
    if (!authenticated.scopes.includes("conversions:write")) return forbidden("conversions:write", requestId);
    const contentLength = request.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_CONVERSION_BODY_BYTES) return invalidRequest("Request body is too large.", requestId, 413);
    let payload: unknown;
    try {
      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > MAX_CONVERSION_BODY_BYTES) return invalidRequest("Request body is too large.", requestId, 413);
      payload = JSON.parse(rawBody);
    } catch { return invalidRequest("Request body must be valid JSON.", requestId); }
    let input;
    try { input = parseConversionPayload(payload); }
    catch (error) { return invalidRequest(error instanceof Error ? error.message : "Invalid conversion data.", requestId); }

    try {
      const existing = await prisma.conversion.findUnique({ where: { source_eventId: { source: MONEY_SITE_SOURCE, eventId: input.event_id } }, select: { id: true } });
      if (existing) return NextResponse.json({ status: "duplicate", conversion_id: existing.id }, { headers: { "x-request-id": requestId } });
      const click = await prisma.click.findUnique({
        where: { clickId: input.cid },
        select: { id: true, trafficSourceId: true, trackingTokens: true, campaign: { select: { ownerId: true } }, trafficSource: { select: { enabled: true, configuration: true } } },
      });
      if (!click || click.campaign.ownerId !== authenticated.principal.id) return NextResponse.json({ error: { code: "not_found", message: "Unknown click ID.", request_id: requestId } }, { status: 404, headers: { "x-request-id": requestId } });

      const conversion = await prisma.$transaction(async (transaction) => {
        const created = await transaction.conversion.create({
          data: { clickRecordId: click.id, source: MONEY_SITE_SOURCE, eventId: input.event_id, eventType: input.event_type, occurredAt: input.occurred_at, valueMinor: input.value_minor, currency: input.currency, transactionReference: input.transaction_reference, payloadHash: hashConversionPayload(payload), validationState: "accepted", correlationId: requestId },
          select: { id: true },
        });
        const definitions = await transaction.customConversion.findMany({ where: { ownerId: authenticated.principal.id }, select: { id: true, eventValues: true, sendPostbackToTrafficSource: true } });
        const destination = click.trafficSource?.enabled ? getConversionPostbackDestination(click.trafficSource.configuration, input.event_type, definitions) : undefined;
        if (!isSetupTestClick(click.trackingTokens) && click.trafficSourceId !== null && click.trafficSource?.enabled && destination !== undefined) {
          await transaction.outboundPostback.create({ data: { conversionId: created.id, trafficSourceId: click.trafficSourceId, destination, correlationId: requestId } });
        }
        await transaction.auditEntry.create({ data: { action: "conversion.accepted_via_api", entityType: "conversion", entityId: created.id, actor: authenticated.principal.email, metadata: { eventType: input.event_type }, correlationId: requestId } });
        return created;
      });
      logger.info("conversion.accepted", { correlationId: requestId, conversionId: conversion.id, source: "customer_api" });
      return NextResponse.json({ status: "accepted", conversion_id: conversion.id }, { status: 201, headers: { "x-request-id": requestId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await prisma.conversion.findUnique({ where: { source_eventId: { source: MONEY_SITE_SOURCE, eventId: input.event_id } }, select: { id: true } });
        if (existing) return NextResponse.json({ status: "duplicate", conversion_id: existing.id }, { headers: { "x-request-id": requestId } });
      }
      logger.error("conversion.failed", { correlationId: requestId, errorName: error instanceof Error ? error.name : "UnknownError", source: "customer_api" });
      return NextResponse.json({ error: { code: "internal_error", message: "Conversion could not be recorded.", request_id: requestId } }, { status: 500, headers: { "x-request-id": requestId } });
    }
  }

  if (request.method === "GET" && path.join("/") === "overview") {
    if (!authenticated.scopes.includes("analytics:read")) return forbidden("analytics:read", requestId);
    const url = new URL(request.url);
    const filters = {
      ownerId: authenticated.principal.id,
      from: parseDateInTimezone(url.searchParams.get("from") ?? undefined, authenticated.principal.timezone),
      to: parseDateInTimezone(url.searchParams.get("to") ?? undefined, authenticated.principal.timezone, true),
      campaignId: url.searchParams.get("campaign") ?? undefined,
      trafficSourceId: url.searchParams.get("source") ?? undefined,
      eventType: url.searchParams.get("event")?.trim().slice(0, 100) || undefined,
    };
    const metrics = await getOverviewMetrics(filters);
    return NextResponse.json({ metrics, timezone: authenticated.principal.timezone }, { headers: { "x-request-id": requestId } });
  }

  if (request.method === "GET" && path.length === 3 && path[0] === "campaigns" && path[2] === "report") {
    if (!authenticated.scopes.includes("analytics:read")) return forbidden("analytics:read", requestId);
    const url = new URL(request.url);
    const detail = await getCampaignDetail(path[1], {
      ownerId: authenticated.principal.id,
      from: parseDateInTimezone(url.searchParams.get("from") ?? undefined, authenticated.principal.timezone),
      to: parseDateInTimezone(url.searchParams.get("to") ?? undefined, authenticated.principal.timezone, true),
      eventType: url.searchParams.get("event")?.trim().slice(0, 100) || undefined,
    });
    if (!detail) return NextResponse.json({ error: { code: "not_found", message: "Campaign not found.", request_id: requestId } }, { status: 404, headers: { "x-request-id": requestId } });
    const json = JSON.stringify(detail, (key, value: unknown) => key === "lastError" && (typeof value === "string" || value === null) ? sanitizeDiagnostic(value) : typeof value === "bigint" ? value.toString() : value);
    return new Response(json, { headers: { "content-type": "application/json", "x-request-id": requestId } });
  }

  if (request.method === "GET" && path.length === 3 && path[0] === "traffic-sources" && path[2] === "report") {
    if (!authenticated.scopes.includes("analytics:read")) return forbidden("analytics:read", requestId);
    const source = await prisma.trafficSource.findFirst({ where: { id: path[1], ownerId: authenticated.principal.id }, select: { id: true, name: true, type: true, enabled: true, credentialSecretRef: true, configuration: true, retryPolicy: true, createdAt: true, updatedAt: true } });
    if (!source) return NextResponse.json({ error: { code: "not_found", message: "Traffic source not found.", request_id: requestId } }, { status: 404, headers: { "x-request-id": requestId } });
    const [visits, conversions, eventRows] = await Promise.all([
      prisma.click.count({ where: { trafficSourceId: source.id, campaign: { ownerId: authenticated.principal.id } } }),
      prisma.conversion.count({ where: { click: { trafficSourceId: source.id, campaign: { ownerId: authenticated.principal.id } } } }),
      prisma.conversion.groupBy({ by: ["eventType"], where: { click: { trafficSourceId: source.id, campaign: { ownerId: authenticated.principal.id } } }, _count: { _all: true }, orderBy: { eventType: "asc" } }),
    ]);
    return NextResponse.json({ trafficSource: { id: source.id, name: source.name, type: source.type, enabled: source.enabled, hasCredentialSecretRef: source.credentialSecretRef !== null, configuration: safeTrafficSourceConfiguration(source.configuration), retryPolicy: source.retryPolicy, createdAt: source.createdAt, updatedAt: source.updatedAt }, metrics: { visits, conversions, events: eventRows.map((row) => ({ event_type: row.eventType, count: row._count._all })) } }, { headers: { "x-request-id": requestId } });
  }

  if (request.method === "GET" && path.length === 2 && path[0] === "activity" && (path[1] === "clicks" || path[1] === "conversions")) {
    const scope = path[1] === "clicks" ? "analytics:read" : "conversions:read";
    if (!authenticated.scopes.includes(scope)) return forbidden(scope, requestId);
    const url = new URL(request.url);
    const requested = Number(url.searchParams.get("limit") ?? 50);
    const limit = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), 100) : 50;
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const from = parseDateInTimezone(url.searchParams.get("from") ?? undefined, authenticated.principal.timezone);
    const to = parseDateInTimezone(url.searchParams.get("to") ?? undefined, authenticated.principal.timezone, true);
    const campaignId = url.searchParams.get("campaign") ?? undefined;
    if (path[1] === "clicks") {
      if (cursor && !/^[A-Za-z0-9_-]{20,100}$/.test(cursor)) return NextResponse.json({ error: { code: "invalid_request", message: "Invalid cursor.", request_id: requestId } }, { status: 400, headers: { "x-request-id": requestId } });
      const rows = await prisma.click.findMany({
        where: { campaign: { ownerId: authenticated.principal.id }, ...(campaignId ? { campaignId } : {}), ...(from || to ? { clickedAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}) },
        orderBy: [{ clickedAt: "desc" }, { id: "desc" }], take: limit + 1,
        ...(cursor ? { cursor: { clickId: cursor }, skip: 1 } : {}),
        select: { clickId: true, clickedAt: true, referrer: true, destinationUrl: true, trackingTokens: true, campaign: { select: { id: true, name: true, slug: true } } },
      });
      return paginated(rows, limit, requestId, "clicks");
    }
    if (cursor && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cursor)) return NextResponse.json({ error: { code: "invalid_request", message: "Invalid cursor.", request_id: requestId } }, { status: 400, headers: { "x-request-id": requestId } });
    const rows = await prisma.conversion.findMany({
      where: { click: { campaign: { ownerId: authenticated.principal.id }, ...(campaignId ? { campaignId } : {}) }, ...(from || to ? { occurredAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}), ...(url.searchParams.get("event") ? { eventType: url.searchParams.get("event")!.slice(0, 100) } : {}) },
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }], take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, eventId: true, eventType: true, occurredAt: true, receivedAt: true, valueMinor: true, currency: true, transactionReference: true, click: { select: { clickId: true, campaign: { select: { id: true, name: true, slug: true } } } }, outboundPostbacks: { select: { status: true, deliveredAt: true, lastError: true } } },
    });
    return paginated(rows, limit, requestId, "conversions");
  }

  const resolved = resolveRoute(request.method, path);
  if (!resolved) return NextResponse.json({ error: { code: "not_found", message: "API endpoint not found.", request_id: requestId } }, { status: 404, headers: { "x-request-id": requestId } });
  if (!authenticated.scopes.includes(resolved.route.scope)) return NextResponse.json({ error: { code: "forbidden", message: `The API key does not have ${resolved.route.scope} access.`, request_id: requestId } }, { status: 403, headers: { "x-request-id": requestId } });

  const response = await runWithApiKeyPrincipal(authenticated.principal, () => resolved.route.handler(request, resolved.params));
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method) && response.ok) {
    try {
      await prisma.auditEntry.create({
        data: { action: "api.workspace_action", entityType: "api_key", entityId: authenticated.keyId, actor: authenticated.principal.email, metadata: { method: request.method, path: `/api/v1/${path.join("/")}` }, correlationId: requestId },
      });
    } catch (error) {
      logger.error("api.workspace_action_audit_failed", { errorName: error instanceof Error ? error.name : "UnknownError", requestId });
    }
  }
  return response;
}

async function route(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const path = (await context.params).path;
  let response = await handle(request, path);
  if (request.method === "GET" && response.ok) {
    const listNameByPath: Record<string, string> = {
      campaigns: "campaigns",
      offers: "offers",
      "traffic-sources": "trafficSources",
      "custom-conversions": "customConversions",
    };
    const listName = path.length === 1 ? listNameByPath[path[0]] : undefined;
    if (listName) {
      const url = new URL(request.url);
      const rawLimit = url.searchParams.get("limit");
      const rawOffset = url.searchParams.get("offset");
      const limit = rawLimit === null ? 50 : Number(rawLimit);
      const offset = rawOffset === null ? 0 : Number(rawOffset);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0 || offset > 10_000) {
        response = invalidRequest("limit must be 1–100 and offset must be 0–10000.", getCorrelationId(request));
      } else {
        const body = await response.clone().json() as Record<string, unknown>;
        const rows = body[listName];
        if (Array.isArray(rows)) {
          const page = rows.slice(offset, offset + limit);
          body[listName] = page;
          body.pagination = { limit, offset, next_offset: offset + page.length < rows.length ? offset + page.length : null };
          const headers = new Headers(response.headers);
          headers.set("content-type", "application/json");
          response = new Response(JSON.stringify(body), { status: response.status, headers });
        }
      }
    }
  }
  const headers = new Headers(response.headers);
  headers.set("cache-control", "private, no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function forbidden(scope: string, requestId: string) {
  return NextResponse.json({ error: { code: "forbidden", message: `The API key does not have ${scope} access.`, request_id: requestId } }, { status: 403, headers: { "x-request-id": requestId } });
}

function invalidRequest(message: string, requestId: string, status = 400) {
  return NextResponse.json({ error: { code: "invalid_request", message, request_id: requestId } }, { status, headers: { "x-request-id": requestId } });
}

function paginated<T extends { id?: string; clickId?: string }>(rows: T[], limit: number, requestId: string, name: string) {
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  const nextCursor = hasMore && last ? (last.clickId ?? last.id ?? null) : null;
  return NextResponse.json({ [name]: items, pagination: { limit, next_cursor: nextCursor } }, { headers: { "x-request-id": requestId } });
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) { return route(request, context); }
export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) { return route(request, context); }
export async function PUT(request: Request, context: { params: Promise<{ path: string[] }> }) { return route(request, context); }
export async function PATCH(request: Request, context: { params: Promise<{ path: string[] }> }) { return route(request, context); }
export async function DELETE(request: Request, context: { params: Promise<{ path: string[] }> }) { return route(request, context); }
