import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/database/prisma";
import { getCorrelationId } from "@/lib/observability/correlation-id";
import { logger } from "@/lib/observability/logger";
import {
  getPostbackDestination,
  hashConversionPayload,
  parseVoluumPostback,
  VOLUUM_COMPAT_SOURCE,
} from "@/lib/conversions/intake";

const PIXEL = Uint8Array.from(Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64"));

function pixelResponse(correlationId: string, status = 200): Response {
  return new Response(PIXEL, {
    status,
    headers: {
      "cache-control": "no-store, max-age=0",
      "content-type": "image/gif",
      "x-request-id": correlationId,
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const correlationId = getCorrelationId(request);
  const url = new URL(request.url);

  let input;
  try {
    input = parseVoluumPostback(url);
  } catch {
    return pixelResponse(correlationId, 400);
  }

  try {
    const existing = await prisma.conversion.findUnique({
      where: { source_eventId: { source: VOLUUM_COMPAT_SOURCE, eventId: input.eventId } },
      select: { id: true },
    });
    if (existing) return pixelResponse(correlationId);

    const click = await prisma.click.findUnique({
      where: { clickId: input.cid },
      select: {
        id: true,
        trafficSourceId: true,
        campaign: { select: { defaultCurrency: true } },
        trafficSource: { select: { enabled: true, configuration: true } },
      },
    });
    if (!click) return pixelResponse(correlationId, 404);

    const conversion = await prisma.$transaction(async (transaction) => {
      const created = await transaction.conversion.create({
        data: {
          clickRecordId: click.id,
          source: VOLUUM_COMPAT_SOURCE,
          eventId: input.eventId,
          eventType: input.eventType,
          occurredAt: input.occurredAt,
          valueMinor: input.valueMinor,
          currency: input.currency ?? click.campaign.defaultCurrency,
          transactionReference: input.transactionReference,
          payloadHash: hashConversionPayload(Object.fromEntries(url.searchParams.entries())),
          validationState: "accepted",
          correlationId,
        },
        select: { id: true },
      });

      const destination = click.trafficSource?.enabled
        ? getPostbackDestination(click.trafficSource.configuration)
        : undefined;
      if (click.trafficSourceId !== null && click.trafficSource?.enabled && destination !== undefined) {
        await transaction.outboundPostback.create({
          data: {
            conversionId: created.id,
            trafficSourceId: click.trafficSourceId,
            destination,
            correlationId,
          },
        });
      }
      return created;
    });

    logger.info("voluum_postback.accepted", {
      correlationId,
      conversionId: conversion.id,
      eventType: input.eventType,
    });
    return pixelResponse(correlationId);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return pixelResponse(correlationId);
    }
    logger.error("voluum_postback.failed", {
      correlationId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return pixelResponse(correlationId, 500);
  }
}
