import { Queue } from "bullmq";
import { bullRedis } from "../config/redis";

export const activityQueue = new Queue("activity", {
  connection: bullRedis,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 500,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});
