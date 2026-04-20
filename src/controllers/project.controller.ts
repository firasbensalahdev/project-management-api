import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import {
  getProjectsService,
  getProjectByIdService,
  createProjectService,
  updateProjectService,
  deleteProjectService,
} from "../services/project.service";
import {
  createProjectSchema,
  updateProjectSchema,
} from "../validators/project.validator";
import { AppError } from "../utils/AppError";

export const getProjects = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const projects = await getProjectsService(Number(req.params.workspaceId));
    res.json({ success: true, data: projects });
  } catch (error) {
    next(error);
  }
};

export const getProjectById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const project = await getProjectByIdService(Number(req.params.id));
    res.json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
};

export const createProject = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.message, 400);
    }
    const project = await createProjectService(
      Number(req.params.workspaceId),
      parsed.data,
    );
    res.status(201).json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
};

export const updateProject = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = updateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.message, 400);
    }
    const project = await updateProjectService(
      Number(req.params.id),
      parsed.data,
    );
    res.json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
};

export const deleteProject = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    await deleteProjectService(Number(req.params.id));
    res.json({ success: true, message: "Project deleted successfully" });
  } catch (error) {
    next(error);
  }
};
