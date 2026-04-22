import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import {
  CreateTaskInput,
  UpdateTaskInput,
  TaskQueryInput,
} from "../validators/task.validator";
import { logActivity } from "../utils/activity";

export const getTasksService = async (
  projectId: number,
  query: TaskQueryInput,
) => {
  const limit = parseInt(query.limit || "10");
  const cursor = query.cursor
    ? parseInt(Buffer.from(query.cursor, "base64").toString())
    : undefined;

  const where: any = {
    projectId,
    deletedAt: null,
    ...(query.status && { status: query.status }),
    ...(query.assignedToId && {
      assignedToId: parseInt(query.assignedToId),
    }),
    ...(cursor && { id: { lt: cursor } }),
  };

  const tasks = await prisma.task.findMany({
    where,
    take: limit + 1, // fetch one extra to check if there are more
    orderBy: { id: "desc" },
    include: {
      assignedTo: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      _count: { select: { comments: true } },
    },
  });

  const hasMore = tasks.length > limit;
  const data = hasMore ? tasks.slice(0, limit) : tasks;
  const nextCursor = hasMore
    ? Buffer.from(String(data[data.length - 1].id)).toString("base64")
    : null;

  const total = await prisma.task.count({
    where: { projectId, deletedAt: null },
  });

  return { data, nextCursor, hasMore, total };
};

export const getTaskByIdService = async (taskId: number) => {
  const task = await prisma.task.findUnique({
    where: { id: taskId, deletedAt: null },
    include: {
      assignedTo: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      _count: { select: { comments: true } },
    },
  });
  if (!task) throw new AppError("Task not found", 404);
  return task;
};

export const createTaskService = async (
  projectId: number,
  userId: number,
  input: CreateTaskInput,
  workspaceId: number,
  userName: string,
) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId, deletedAt: null },
  });
  if (!project) throw new AppError("Project not found", 404);

  const task = await prisma.task.create({
    data: {
      title: input.title,
      description: input.description,
      assignedToId: input.assignedToId,
      projectId,
      createdById: userId,
    },
    include: {
      assignedTo: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  // log activity
  await logActivity({
    workspaceId,
    userId,
    userName,
    action: "task.created",
    entityType: "task",
    entityId: task.id,
    metadata: { taskTitle: task.title, projectId },
  });

  return task;
};

export const updateTaskService = async (
  taskId: number,
  userId: number,
  input: UpdateTaskInput,
  userRole: string,
) => {
  const task = await getTaskByIdService(taskId);

  // members can only edit their own tasks
  if (userRole === "member" && task.createdById !== userId) {
    throw new AppError("You can only edit your own tasks", 403);
  }

  return prisma.task.update({
    where: { id: taskId },
    data: input,
    include: {
      assignedTo: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });
};

export const deleteTaskService = async (
  taskId: number,
  userId: number,
  userRole: string,
) => {
  const task = await getTaskByIdService(taskId);

  // members can only delete their own tasks
  if (userRole === "member" && task.createdById !== userId) {
    throw new AppError("You can only delete your own tasks", 403);
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { deletedAt: new Date() },
  });
};

export const assignTaskService = async (
  taskId: number,
  assignedToId: number | null,
) => {
  await getTaskByIdService(taskId);

  return prisma.task.update({
    where: { id: taskId },
    data: { assignedToId },
    include: {
      assignedTo: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
  });
};

export const updateTaskStatusService = async (
  taskId: number,
  status: string,
) => {
  await getTaskByIdService(taskId);

  return prisma.task.update({
    where: { id: taskId },
    data: { status },
  });
};

export const uploadTaskAttachmentService = async (
  taskId: number,
  file: Express.Multer.File,
) => {
  const { uploadToS3 } = await import("../utils/uploadImage");
  await getTaskByIdService(taskId);

  const attachmentUrl = await uploadToS3(file, "attachments");

  return prisma.task.update({
    where: { id: taskId },
    data: { attachmentUrl },
  });
};
