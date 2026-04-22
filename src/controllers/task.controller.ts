import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import {
  getTasksService,
  getTaskByIdService,
  createTaskService,
  updateTaskService,
  deleteTaskService,
  assignTaskService,
  updateTaskStatusService,
  uploadTaskAttachmentService,
} from "../services/task.service";
import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  assignTaskSchema,
  taskQuerySchema,
} from "../validators/task.validator";
import { AppError } from "../utils/AppError";
import { prisma } from "../config/prisma";

export const getTasks = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = taskQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(parsed.error.message, 400);
    }
    const result = await getTasksService(
      Number(req.params.projectId),
      parsed.data,
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const getTaskById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const task = await getTaskByIdService(Number(req.params.id));
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

export const createTask = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.message, 400);
    }

    // get user details for activity log
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { name: true },
    });

    // get workspaceId from project
    const project = await prisma.project.findUnique({
      where: { id: Number(req.params.projectId) },
      select: { workspaceId: true },
    });

    const task = await createTaskService(
      Number(req.params.projectId),
      req.userId!,
      parsed.data,
      project?.workspaceId || 0,
      user?.name || "",
    );
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

export const updateTask = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = updateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.message, 400);
    }
    const task = await updateTaskService(
      Number(req.params.id),
      req.userId!,
      parsed.data,
      req.userRole || "member",
    );
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

export const deleteTask = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    await deleteTaskService(
      Number(req.params.id),
      req.userId!,
      req.userRole || "member",
    );
    res.json({ success: true, message: "Task deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const assignTask = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = assignTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.message, 400);
    }
    const task = await assignTaskService(
      Number(req.params.id),
      parsed.data.assignedToId,
    );
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

export const updateTaskStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = updateTaskStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.message, 400);
    }
    const task = await updateTaskStatusService(
      Number(req.params.id),
      parsed.data.status,
    );
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

export const uploadTaskAttachment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.file) throw new AppError("No file provided", 400);
    const task = await uploadTaskAttachmentService(
      Number(req.params.id),
      req.file,
    );
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};
