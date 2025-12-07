import Fastify from "fastify";
import dotenv from "dotenv";
import { getRedisClient, closeRedisConnection } from "../../shared/redisClient";
import { startConsumer } from "../../shared/eventConsumer";
import {
  handleAuditEvent,
  getAuditLogs,
  getAuditStats,
} from "./handlers/auditHandler";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3005", 10);

async function main() {
  const fastify = Fastify({
    logger: {
      level: "info",
      transport: {
        target: "pino-pretty",
        options: {
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      },
    },
  });

  let stopConsumer: (() => void) | null = null;

  try {
    // Inicializar conexão Redis
    await getRedisClient();
    fastify.log.info("Conectado ao Redis");

    // Iniciar consumidor de eventos - inscrever em TODOS os eventos (sem filtro)
    stopConsumer = await startConsumer({
      streamKey: process.env.REDIS_STREAM_KEY || "events-stream",
      groupName: "audit-service-group",
      consumerName: "audit-consumer-1",
      handler: handleAuditEvent,
    });
    fastify.log.info(
      "Consumidor de eventos de auditoria iniciado - ouvindo TODOS os eventos"
    );

    // Endpoint de verificação de saúde
    fastify.get("/health", async () => {
      return { status: "ok", service: "audit-service" };
    });

    // Obter todos os logs de auditoria
    fastify.get("/audit", async (request) => {
      const { limit, eventType } = request.query as {
        limit?: string;
        eventType?: string;
      };
      return getAuditLogs(limit ? parseInt(limit, 10) : undefined, eventType);
    });

    // Obter estatísticas de auditoria
    fastify.get("/audit/stats", async () => {
      return getAuditStats();
    });

    // Encerramento gracioso
    const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        fastify.log.info(`Sinal ${signal} recebido, encerrando...`);
        if (stopConsumer) stopConsumer();
        await fastify.close();
        await closeRedisConnection();
        process.exit(0);
      });
    });

    // Iniciar servidor
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    fastify.log.info(`Serviço de Auditoria rodando na porta ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
