import { getRedisClient } from "./redisClient";
import { BaseEvent, ConsumerConfig, EventHandler } from "./types";

const STREAM_KEY = process.env.REDIS_STREAM_KEY || "events-stream";

// In-memory set for idempotency (in production, use Redis SET)
const processedEvents = new Set<string>();

export interface ConsumerOptions {
  streamKey?: string;
  blockMs?: number;
  count?: number;
  startId?: string;
}

async function ensureConsumerGroup(
  streamKey: string,
  groupName: string
): Promise<void> {
  const client = await getRedisClient();

  try {
    // Try to create the consumer group
    await client.xGroupCreate(streamKey, groupName, "0", {
      MKSTREAM: true,
    });
    console.log(`[Consumer] Created consumer group: ${groupName}`);
  } catch (error: unknown) {
    // Group already exists - this is fine
    if (error instanceof Error && error.message.includes("BUSYGROUP")) {
      console.log(`[Consumer] Consumer group already exists: ${groupName}`);
    } else {
      throw error;
    }
  }
}

function parseStreamMessage(message: {
  id: string;
  message: Record<string, string>;
}): BaseEvent {
  return {
    eventId: message.message.eventId,
    eventType: message.message.eventType,
    timestamp: message.message.timestamp,
    payload: JSON.parse(message.message.payload),
  };
}

export async function startConsumer(
  config: ConsumerConfig,
  options?: ConsumerOptions
): Promise<() => void> {
  const client = await getRedisClient();
  const streamKey = options?.streamKey || STREAM_KEY;
  const blockMs = options?.blockMs || 5000;
  const count = options?.count || 10;

  await ensureConsumerGroup(streamKey, config.groupName);

  let isRunning = true;

  const consumeLoop = async () => {
    console.log(
      `[Consumer] Starting consumer: ${config.consumerName} in group: ${config.groupName}`
    );

    while (isRunning) {
      try {
        // Read pending messages first, then new messages
        const streams = await client.xReadGroup(
          config.groupName,
          config.consumerName,
          [{ key: streamKey, id: ">" }],
          {
            COUNT: count,
            BLOCK: blockMs,
          }
        );

        if (!streams || streams.length === 0) {
          continue;
        }

        for (const stream of streams) {
          for (const message of stream.messages) {
            const event = parseStreamMessage(message);

            // Idempotency check
            if (processedEvents.has(event.eventId)) {
              console.log(
                `[Consumer] Skipping duplicate event: ${event.eventId}`
              );
              await client.xAck(streamKey, config.groupName, message.id);
              continue;
            }

            // Filter by event type if specified
            if (
              config.eventTypes &&
              !config.eventTypes.includes(event.eventType)
            ) {
              await client.xAck(streamKey, config.groupName, message.id);
              continue;
            }

            try {
              console.log(
                `[Consumer] Processing event: ${event.eventType} (${event.eventId})`
              );
              await config.handler(event);

              // Mark as processed for idempotency
              processedEvents.add(event.eventId);

              // Acknowledge the message
              await client.xAck(streamKey, config.groupName, message.id);
              console.log(`[Consumer] Event acknowledged: ${event.eventId}`);
            } catch (handlerError) {
              console.error(
                `[Consumer] Error processing event ${event.eventId}:`,
                handlerError
              );
              // Don't acknowledge - message will be reprocessed
            }
          }
        }
      } catch (error) {
        console.error("[Consumer] Error reading from stream:", error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  };

  // Start the consume loop in the background
  consumeLoop().catch(console.error);

  // Return a stop function
  return () => {
    isRunning = false;
    console.log(`[Consumer] Stopping consumer: ${config.consumerName}`);
  };
}

export function clearProcessedEvents(): void {
  processedEvents.clear();
}

export function isEventProcessed(eventId: string): boolean {
  return processedEvents.has(eventId);
}
