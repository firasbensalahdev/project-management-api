import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "../utils/logger";

export const connectMongo = async (): Promise<void> => {
  try {
    mongoose.set("strictQuery", true);

    mongoose.connection.on("connected", () => {
      logger.info("MongoDB connected");
    });

    mongoose.connection.on("error", (err) => {
      logger.error({ err }, "MongoDB connection error");
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });

    await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: 10,
    });
  } catch (error) {
    logger.error({ error }, "MongoDB connection failed");
    process.exit(1);
  }
};
