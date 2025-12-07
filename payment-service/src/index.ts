import Fastify from "fastify";
import dotenv from "dotenv";
import { getRedisClient, closeRedisConnection } from "../../shared/redisClient";
import { startConsumer } from "../../shared/eventConsumer";
import { handlePaymentEvent } from "./handlers/paymentHandler";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3002", 10);

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

    // Start event consumer
    stopConsumer = await startConsumer({
      streamKey: process.env.REDIS_STREAM_KEY || "events-stream",
      groupName: "payment-service-group",
      consumerName: "payment-consumer-1",
      eventTypes: ["OrderCreated"],
      handler: handlePaymentEvent,
    });
    fastify.log.info("Payment event consumer started");

    // Health check endpoint
    fastify.get("/health", async () => {
      return { status: "ok", service: "payment-service" };
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
    fastify.log.info(`Payment Service running on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
