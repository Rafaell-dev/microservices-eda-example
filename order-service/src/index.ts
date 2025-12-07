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
    // Inicializar conexão Redis
    await getRedisClient();
    fastify.log.info("Conectado ao Redis");

    // Registrar rotas
    await registerOrderRoutes(fastify);

    // Encerramento
    const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        fastify.log.info(`Sinal ${signal} recebido, encerrando...`);
        await fastify.close();
        await closeRedisConnection();
        process.exit(0);
      });
    });

    // Iniciar servidor
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    fastify.log.info(`Serviço de Pedidos rodando na porta ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
