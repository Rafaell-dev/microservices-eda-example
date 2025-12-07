import { getRedisClient } from "./redisClient";
import { BaseEvent, ConsumerConfig, EventHandler } from "./types";

const STREAM_KEY = process.env.REDIS_STREAM_KEY || "events-stream";

// Conjunto em memória para idempotência (em produção, usar Redis SET)
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
    // Tentar criar o grupo de consumidores
    await client.xGroupCreate(streamKey, groupName, "0", {
      MKSTREAM: true,
    });
    console.log(`[Consumidor] Grupo de consumidores criado: ${groupName}`);
  } catch (error: unknown) {
    // Grupo já existe
    if (error instanceof Error && error.message.includes("BUSYGROUP")) {
      console.log(`[Consumidor] Grupo de consumidores já existe: ${groupName}`);
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
      `[Consumidor] Iniciando consumidor: ${config.consumerName} no grupo: ${config.groupName}`
    );

    while (isRunning) {
      try {
        // Ler mensagens pendentes primeiro, depois novas mensagens
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

            // Verificação de idempotência
            if (processedEvents.has(event.eventId)) {
              console.log(
                `[Consumidor] Ignorando evento duplicado: ${event.eventId}`
              );
              await client.xAck(streamKey, config.groupName, message.id);
              continue;
            }

            // Filtrar por tipo de evento se especificado
            if (
              config.eventTypes &&
              !config.eventTypes.includes(event.eventType)
            ) {
              await client.xAck(streamKey, config.groupName, message.id);
              continue;
            }

            try {
              console.log(
                `[Consumidor] Processando evento: ${event.eventType} (${event.eventId})`
              );
              await config.handler(event);

              // Marcar como processado para idempotência
              processedEvents.add(event.eventId);

              // Confirmar recebimento da mensagem
              await client.xAck(streamKey, config.groupName, message.id);
              console.log(`[Consumidor] Evento confirmado: ${event.eventId}`);
            } catch (handlerError) {
              console.error(
                `[Consumidor] Erro ao processar evento ${event.eventId}:`,
                handlerError
              );
              // Não confirmar - mensagem será reprocessada
            }
          }
        }
      } catch (error) {
        console.error("[Consumidor] Erro ao ler do stream:", error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  };

  // Iniciar o loop de consumo em segundo plano
  consumeLoop().catch(console.error);

  // Retornar função de parada
  return () => {
    isRunning = false;
    console.log(`[Consumidor] Parando consumidor: ${config.consumerName}`);
  };
}

export function clearProcessedEvents(): void {
  processedEvents.clear();
}

export function isEventProcessed(eventId: string): boolean {
  return processedEvents.has(eventId);
}
