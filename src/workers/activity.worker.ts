import { Worker, Job } from "bullmq";
import { bullRedis } from "../config/redis";
import { ActivityLog } from "../models/activityLog.model";
import { logger } from "../utils/logger";

export interface ActivityJob {
  workspaceId: number;
  userId: number;
  userName: string;
  action: string;
  entityType: string;
  entityId: number;
  metadata: Record<string, any>;
}

const processActivityJob = async (job: Job<ActivityJob>) => {
  const {
    workspaceId,
    userId,
    userName,
    action,
    entityType,
    entityId,
    metadata,
  } = job.data;

  await ActivityLog.create({
    workspaceId,
    userId,
    userName,
    action,
    entityType,
    entityId,
    metadata,
  });

  logger.debug({ jobId: job.id, action }, "Activity logged");
};

export const startActivityWorker = () => {
  const worker = new Worker("activity", processActivityJob, {
    connection: bullRedis,
    concurrency: 10,
  });

  worker.on("completed", (job) => {
    logger.debug({ jobId: job.id }, "Activity job completed");
  });

  worker.on("failed", (job, error) => {
    logger.error(
      { jobId: job?.id, error: error.message },
      "Activity job failed",
    );

    if (job && job.attemptsMade >= 2) {
      logger.error(
        { jobId: job.id, data: job.data },
        "Activity job moved to dead letter queue after max retries",
      );
    }
  });

  logger.info("Activity worker started");
  return worker;
};
