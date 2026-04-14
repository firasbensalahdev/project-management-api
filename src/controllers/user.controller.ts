import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import {
  getMyProfileService,
  updateMyProfileService,
  uploadAvatarService,
  getPresignedUrlService,
} from "../services/user.service";
import {
  updateUserSchema,
  presignedUrlSchema,
} from "../validators/user.validator";
import { AppError } from "../utils/AppError";

export const getMyProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await getMyProfileService(req.userId!);
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const updateMyProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.message, 400);
    }
    const user = await updateMyProfileService(req.userId!, parsed.data);
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const uploadAvatar = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.file) throw new AppError("No file provided", 400);
    const user = await uploadAvatarService(req.userId!, req.file);
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const getPresignedUrl = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = presignedUrlSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.message, 400);
    }
    const result = await getPresignedUrlService(
      parsed.data.filename,
      parsed.data.mimetype,
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
