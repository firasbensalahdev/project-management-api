import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import {
  getCommentsService,
  createCommentService,
  deleteCommentService,
} from "../services/comment.service";
import { createCommentSchema } from "../validators/comment.validator";
import { AppError } from "../utils/AppError";

export const getComments = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const comments = await getCommentsService(Number(req.params.taskId));
    res.json({ success: true, data: comments });
  } catch (error) {
    next(error);
  }
};

export const createComment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = createCommentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.message, 400);
    }
    const comment = await createCommentService(
      Number(req.params.taskId),
      req.userId!,
      parsed.data,
    );
    res.status(201).json({ success: true, data: comment });
  } catch (error) {
    next(error);
  }
};

export const deleteComment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    await deleteCommentService(
      Number(req.params.id),
      req.userId!,
      req.userRole || "member",
    );
    res.json({ success: true, message: "Comment deleted successfully" });
  } catch (error) {
    next(error);
  }
};
