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
    // Initialize Redis connection
    await getRedisClient();
    fastify.log.info("Connected to Redis");

    // Start event consumer - subscribe to ALL events (no filter)
    stopConsumer = await startConsumer({
      streamKey: process.env.REDIS_STREAM_KEY || "events-stream",
      groupName: "audit-service-group",
      consumerName: "audit-consumer-1",
      handler: handleAuditEvent,
    });
    fastify.log.info("Audit event consumer started - listening to ALL events");

    // Health check endpoint
    fastify.get("/health", async () => {
      return { status: "ok", service: "audit-service" };
    });

    // Get all audit logs
    fastify.get("/audit", async (request) => {
      const { limit, eventType } = request.query as {
        limit?: string;
        eventType?: string;
      };
      return getAuditLogs(limit ? parseInt(limit, 10) : undefined, eventType);
    });

    // Get audit statistics
    fastify.get("/audit/stats", async () => {
      return getAuditStats();
    });

    // Graceful shutdown
    const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        fastify.log.info(`Received ${signal}, shutting down...`);
        if (stopConsumer) stopConsumer();
        await fastify.close();
        await closeRedisConnection();
        process.exit(0);
      });
    });

    // Start server
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    fastify.log.info(`Audit Service running on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
