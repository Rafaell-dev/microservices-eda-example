import { createClient, RedisClientType } from "redis";

let client: RedisClientType | null = null;

export interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
}

export async function getRedisClient(
  config?: RedisConfig
): Promise<RedisClientType> {
  if (client && client.isOpen) {
    return client;
  }

  const host = config?.host || process.env.REDIS_HOST || "localhost";
  const port = config?.port || parseInt(process.env.REDIS_PORT || "6379", 10);
  const password = config?.password || process.env.REDIS_PASSWORD;

  const url = password
    ? `redis://:${password}@${host}:${port}`
    : `redis://${host}:${port}`;

  client = createClient({ url });

  client.on("error", (err) => {
    console.error("Redis Client Error:", err);
  });

  client.on("connect", () => {
    console.log("Redis Client Connected");
  });

  client.on("reconnecting", () => {
    console.log("Redis Client Reconnecting...");
  });

  await client.connect();
  return client;
}

export async function closeRedisConnection(): Promise<void> {
  if (client && client.isOpen) {
    await client.quit();
    client = null;
    console.log("Redis connection closed");
  }
}

export { client };
