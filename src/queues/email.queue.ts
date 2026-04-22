import { Queue } from "bullmq";
import { bullRedis } from "../config/redis";

export const emailQueue = new Queue("email", {
  connection: bullRedis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});
