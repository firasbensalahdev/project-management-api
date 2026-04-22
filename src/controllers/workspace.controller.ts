import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import {
  createWorkspaceService,
  getMyWorkspacesService,
  getWorkspaceByIdService,
  updateWorkspaceService,
  deleteWorkspaceService,
  inviteMemberService,
  removeMemberService,
  getWorkspaceActivityService,
} from "../services/workspace.service";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  inviteMemberSchema,
} from "../validators/workspace.validator";
import { AppError } from "../utils/AppError";
import { prisma } from "../config/prisma";

export const createWorkspace = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = createWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.message, 400);
    }
    const workspace = await createWorkspaceService(req.userId!, parsed.data);
    res.status(201).json({ success: true, data: workspace });
  } catch (error) {
    next(error);
  }
};

export const getMyWorkspaces = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const workspaces = await getMyWorkspacesService(req.userId!);
    res.json({ success: true, data: workspaces });
  } catch (error) {
    next(error);
  }
};

export const getWorkspaceById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const workspace = await getWorkspaceByIdService(
      Number(req.params.id),
      req.userId!,
    );
    res.json({ success: true, data: workspace });
  } catch (error) {
    next(error);
  }
};

export const updateWorkspace = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = updateWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.message, 400);
    }
    const workspace = await updateWorkspaceService(
      Number(req.params.id),
      parsed.data,
    );
    res.json({ success: true, data: workspace });
  } catch (error) {
    next(error);
  }
};

export const deleteWorkspace = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    await deleteWorkspaceService(Number(req.params.id));
    res.json({ success: true, message: "Workspace deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const inviteMember = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = inviteMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.message, 400);
    }

    // get inviter details
    const inviter = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { id: true, name: true },
    });

    const member = await inviteMemberService(
      Number(req.params.id),
      parsed.data,
      inviter!,
    );
    res.status(201).json({ success: true, data: member });
  } catch (error) {
    next(error);
  }
};

export const removeMember = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    await removeMemberService(
      Number(req.params.id),
      Number(req.params.userId),
      req.userId!,
    );
    res.json({ success: true, message: "Member removed successfully" });
  } catch (error) {
    next(error);
  }
};

export const getWorkspaceActivity = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const activity = await getWorkspaceActivityService(Number(req.params.id));
    res.json({ success: true, data: activity });
  } catch (error) {
    next(error);
  }
};
