import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import {
  CreateCommentInput,
  UpdateCommentInput,
} from "../validators/comment.validator";
import { emitToWorkspace } from "../sockets";

export const getCommentsService = async (taskId: number) => {
  const task = await prisma.task.findUnique({
    where: { id: taskId, deletedAt: null },
  });
  if (!task) throw new AppError("Task not found", 404);

  return prisma.comment.findMany({
    where: { taskId, deletedAt: null },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
};

export const createCommentService = async (
  taskId: number,
  userId: number,
  input: CreateCommentInput,
) => {
  const task = await prisma.task.findUnique({
    where: { id: taskId, deletedAt: null },
    include: {
      project: { select: { workspaceId: true } },
    },
  });
  if (!task) throw new AppError("Task not found", 404);

  const comment = await prisma.comment.create({
    data: { content: input.content, taskId, userId },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
  });

  // emit real-time event
  emitToWorkspace(task.project.workspaceId, "comment:added", {
    comment,
    taskId,
  });

  return comment;
};

export const deleteCommentService = async (
  commentId: number,
  userId: number,
  userRole: string,
) => {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId, deletedAt: null },
  });
  if (!comment) throw new AppError("Comment not found", 404);

  // members can only delete their own comments
  if (userRole === "member" && comment.userId !== userId) {
    throw new AppError("You can only delete your own comments", 403);
  }

  await prisma.comment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });
};
