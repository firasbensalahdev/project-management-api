import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/tokens";
import { AppError } from "../utils/AppError";
import { prisma } from "../config/prisma";

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) throw new AppError("No token provided", 401);

    const token = authHeader.split(" ")[1];
    if (!token) throw new AppError("Invalid token format", 401);

    const decoded = verifyAccessToken(token);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    next(new AppError("Invalid or expired token", 401));
  }
};
