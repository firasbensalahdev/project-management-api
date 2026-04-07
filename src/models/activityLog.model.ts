import mongoose, { Document, Schema } from "mongoose";

export interface IActivityLog extends Document {
  workspaceId: number;
  userId: number;
  userName: string;
  action: string;
  entityType: string;
  entityId: number;
  metadata: Record<string, any>;
  createdAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    workspaceId: {
      type: Number,
      required: true,
      index: true,
    },
    userId: {
      type: Number,
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "task.created",
        "task.updated",
        "task.assigned",
        "task.status_changed",
        "task.deleted",
        "comment.added",
        "comment.deleted",
        "member.invited",
        "member.removed",
        "project.created",
        "project.updated",
        "project.deleted",
        "workspace.updated",
      ],
    },
    entityType: {
      type: String,
      required: true,
      enum: ["task", "comment", "member", "project", "workspace"],
    },
    entityId: {
      type: Number,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

// compound index for common query: all activity in a workspace sorted by time
activityLogSchema.index({ workspaceId: 1, createdAt: -1 });

export const ActivityLog = mongoose.model<IActivityLog>(
  "ActivityLog",
  activityLogSchema,
);
