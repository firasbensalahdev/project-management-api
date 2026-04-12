import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";
import {
  requireWorkspacePermission,
  WorkspaceAction,
} from "../utils/permissions";

export const requirePermission = (action: WorkspaceAction) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const workspaceId = Number(req.params.workspaceId || req.params.id);

      if (!workspaceId) {
        return next();
      }

      const role = await requireWorkspacePermission(
        req.userId!,
        workspaceId,
        action,
      );

      req.userRole = role;
      next();
    } catch (error) {
      next(error);
    }
  };
};
