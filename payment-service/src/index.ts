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
    // Inicializar conexão Redis
    await getRedisClient();
    fastify.log.info("Conectado ao Redis");

    // Iniciar consumidor de eventos
    stopConsumer = await startConsumer({
      streamKey: process.env.REDIS_STREAM_KEY || "events-stream",
      groupName: "payment-service-group",
      consumerName: "payment-consumer-1",
      eventTypes: ["OrderCreated"],
      handler: handlePaymentEvent,
    });
    fastify.log.info("Consumidor de eventos de pagamento iniciado");

    // Endpoint de verificação de saúde
    fastify.get("/health", async () => {
      return { status: "ok", service: "payment-service" };
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
    fastify.log.info(`Serviço de Pagamento rodando na porta ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
