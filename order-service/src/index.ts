import Fastify from "fastify";
import dotenv from "dotenv";
import { getRedisClient, closeRedisConnection } from "../../shared/redisClient";
import { registerOrderRoutes } from "./routes/orders";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3001", 10);

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

  try {
    // Initialize Redis connection
    await getRedisClient();
    fastify.log.info("Connected to Redis");

    // Register routes
    await registerOrderRoutes(fastify);

    // Graceful shutdown
    const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        fastify.log.info(`Received ${signal}, shutting down...`);
        await fastify.close();
        await closeRedisConnection();
        process.exit(0);
      });
    });

    // Start server
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    fastify.log.info(`Order Service running on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
