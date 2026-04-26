import Redis from "ioredis";
import { env } from "./env";
import { logger } from "../utils/logger";

const createRedisClient = (name: string): Redis => {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
    tls: env.REDIS_URL.startsWith("rediss://")
      ? { rejectUnauthorized: false }
      : undefined,
  });

  client.on("connect", () => {
    logger.info(`Redis ${name} connected`);
  });

  client.on("error", (err) => {
    logger.error({ err }, `Redis ${name} error`);
  });

  client.on("close", () => {
    logger.warn(`Redis ${name} connection closed`);
  });

  return client;
};

export const redis = createRedisClient("client");

export const bullRedis = createRedisClient("bullmq");

export const socketPubRedis = createRedisClient("socket-pub");
export const socketSubRedis = createRedisClient("socket-sub");
