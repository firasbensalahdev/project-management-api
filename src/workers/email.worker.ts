import { Worker, Job } from "bullmq";
import { bullRedis } from "../config/redis";
import { logger } from "../utils/logger";

export interface WorkspaceInviteJob {
  type: "workspace.invite";
  data: {
    inviteeEmail: string;
    inviteeName: string;
    workspaceName: string;
    inviterName: string;
    role: string;
  };
}

export interface TaskAssignedJob {
  type: "task.assigned";
  data: {
    assigneeEmail: string;
    assigneeName: string;
    taskTitle: string;
    workspaceName: string;
    assignerName: string;
  };
}

export type EmailJob = WorkspaceInviteJob | TaskAssignedJob;

const processEmailJob = async (job: Job<EmailJob>) => {
  const { type, data } = job.data;

  logger.info({ jobId: job.id, type }, "Processing email job");

  switch (type) {
    case "workspace.invite": {
      const { inviteeEmail, inviteeName, workspaceName, inviterName, role } =
        data as WorkspaceInviteJob["data"];

      // TODO: replace with real SendGrid call
      logger.info(
        {
          to: inviteeEmail,
          subject: `You've been invited to ${workspaceName}`,
          body: `Hi ${inviteeName}, ${inviterName} invited you to join ${workspaceName} as ${role}`,
        },
        "Sending workspace invite email",
      );
      break;
    }

    case "task.assigned": {
      const {
        assigneeEmail,
        assigneeName,
        taskTitle,
        workspaceName,
        assignerName,
      } = data as TaskAssignedJob["data"];

      logger.info(
        {
          to: assigneeEmail,
          subject: `Task assigned: ${taskTitle}`,
          body: `Hi ${assigneeName}, ${assignerName} assigned you to "${taskTitle}" in ${workspaceName}`,
        },
        "Sending task assigned email",
      );
      break;
    }

    default:
      logger.warn({ type }, "Unknown email job type");
  }
};

export const startEmailWorker = () => {
  const worker = new Worker("email", processEmailJob, {
    connection: bullRedis,
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, type: job.data.type }, "Email job completed");
  });

  worker.on("failed", (job, error) => {
    logger.error(
      { jobId: job?.id, type: job?.data.type, error: error.message },
      "Email job failed",
    );
  });

  logger.info("Email worker started");
  return worker;
};
