import { activityQueue } from "../queues/activity.queue";
import { ActivityJob } from "../workers/activity.worker";

export const logActivity = async (data: ActivityJob) => {
  await activityQueue.add("log.activity", data);
};
