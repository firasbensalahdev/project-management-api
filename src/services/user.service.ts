import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import {
  uploadToS3,
  deleteFromS3,
  generatePresignedUrl,
} from "../utils/uploadImage";
import { UpdateUserInput } from "../validators/user.validator";

export const getMyProfileService = async (userId: number) => {
  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  if (!user) throw new AppError("User not found", 404);
  return user;
};

export const updateMyProfileService = async (
  userId: number,
  input: UpdateUserInput,
) => {
  if (input.email) {
    const existing = await prisma.user.findFirst({
      where: {
        email: input.email,
        NOT: { id: userId },
      },
    });
    if (existing) throw new AppError("Email already in use", 409);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: input,
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  return user;
};

export const uploadAvatarService = async (
  userId: number,
  file: Express.Multer.File,
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });

  // delete old avatar from S3 if exists
  if (user?.avatarUrl) {
    await deleteFromS3(user.avatarUrl);
  }

  const avatarUrl = await uploadToS3(file, "avatars");

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  return updated;
};

export const getPresignedUrlService = async (
  filename: string,
  mimetype: string,
) => {
  return generatePresignedUrl("avatars", filename, mimetype);
};
