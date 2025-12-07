import Fastify from "fastify";
import dotenv from "dotenv";
import path from "path";
import { getRedisClient, closeRedisConnection } from "../../shared/redisClient";
import { startConsumer } from "../../shared/eventConsumer";
import {
  createDatabase,
  initializeOrderTables,
  closeDatabase,
  DatabaseType,
} from "../../shared/database";
import { registerOrderRoutes } from "./routes/orders";
import { initOrderRepository } from "./utils/orderRepository";
import { handlePaymentEvents } from "./handlers/orderEventHandler";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3001", 10);
const DATABASE_PATH =
  process.env.DATABASE_PATH || path.join(__dirname, "../data/orders.db");

let db: DatabaseType;

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
    // Inicializar banco de dados SQLite
    db = createDatabase(DATABASE_PATH);
    initializeOrderTables(db);
    initOrderRepository(db);
    fastify.log.info(`Banco de dados inicializado: ${DATABASE_PATH}`);

    // Inicializar conexão Redis
    await getRedisClient();
    fastify.log.info("Conectado ao Redis");

    // Iniciar consumidor de eventos de pagamento
    stopConsumer = await startConsumer({
      streamKey: process.env.REDIS_STREAM_KEY || "events-stream",
      groupName: "order-service-group",
      consumerName: "order-consumer-1",
      eventTypes: ["PaymentProcessed", "PaymentFailed"],
      handler: handlePaymentEvents,
    });
    fastify.log.info("Consumidor de eventos de pagamento iniciado");

    // Registrar rotas
    await registerOrderRoutes(fastify);

    // Encerramento
    const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        fastify.log.info(`Sinal ${signal} recebido, encerrando...`);
        if (stopConsumer) stopConsumer();
        await fastify.close();
        await closeRedisConnection();
        closeDatabase(db);
        process.exit(0);
      });
    });

    // Iniciar servidor
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    fastify.log.info(`Serviço de Pedidos rodando na porta ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    if (db) closeDatabase(db);
    process.exit(1);
  }
}

main();
