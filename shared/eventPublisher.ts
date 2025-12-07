import { v4 as uuidv4 } from "uuid";
import { getRedisClient } from "./redisClient";
import { BaseEvent } from "./types";

const STREAM_KEY = process.env.REDIS_STREAM_KEY || "events-stream";

export interface PublishOptions {
  streamKey?: string;
  maxLen?: number;
}

export async function publishEvent<T extends Record<string, unknown>>(
  eventType: string,
  payload: T,
  options?: PublishOptions
): Promise<string> {
  const client = await getRedisClient();

  const event: BaseEvent = {
    eventId: uuidv4(),
    eventType,
    timestamp: new Date().toISOString(),
    payload,
  };

  const streamKey = options?.streamKey || STREAM_KEY;
  const maxLen = options?.maxLen || 10000;

  // Adicionar evento ao stream com corte automático
  const messageId = await client.xAdd(
    streamKey,
    "*",
    {
      eventId: event.eventId,
      eventType: event.eventType,
      timestamp: event.timestamp,
      payload: JSON.stringify(event.payload),
    },
    {
      TRIM: {
        strategy: "MAXLEN",
        strategyModifier: "~",
        threshold: maxLen,
      },
    }
  );

  console.log(
    `[Publicador] Evento publicado: ${eventType} (${event.eventId}) -> ${messageId}`
  );

  return event.eventId;
}

export async function publishRawEvent(
  event: BaseEvent,
  options?: PublishOptions
): Promise<string> {
  const client = await getRedisClient();

  const streamKey = options?.streamKey || STREAM_KEY;
  const maxLen = options?.maxLen || 10000;

  const messageId = await client.xAdd(
    streamKey,
    "*",
    {
      eventId: event.eventId,
      eventType: event.eventType,
      timestamp: event.timestamp,
      payload: JSON.stringify(event.payload),
    },
    {
      TRIM: {
        strategy: "MAXLEN",
        strategyModifier: "~",
        threshold: maxLen,
      },
    }
  );

  console.log(
    `[Publicador] Evento bruto publicado: ${event.eventType} (${event.eventId}) -> ${messageId}`
  );

  return event.eventId;
}

export { STREAM_KEY };
