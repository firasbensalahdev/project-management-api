import bcrypt from "bcrypt";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
} from "../utils/tokens";
import { RegisterInput, LoginInput } from "../validators/auth.validator";

export const registerService = async (input: RegisterInput) => {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });
  if (existing) {
    throw new AppError("Email already in use", 409);
  }

  const hashedPassword = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      password: hashedPassword,
      name: input.name,
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });

  return user;
};

export const loginService = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user || !user.password) {
    throw new AppError("Invalid credentials", 401);
  }

  const isMatch = await bcrypt.compare(input.password, user.password);
  if (!isMatch) {
    throw new AppError("Invalid credentials", 401);
  }

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);
  const tokenHash = hashToken(refreshToken);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
    },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  };
};

export const refreshService = async (rawRefreshToken: string) => {
  // verify token signature first
  let decoded: { userId: number };
  try {
    decoded = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  // check if hashed token exists in DB
  const tokenHash = hashToken(rawRefreshToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
  });

  if (!stored) {
    throw new AppError("Invalid refresh token", 401);
  }

  // rotate — delete old token, issue new ones
  await prisma.refreshToken.delete({
    where: { tokenHash },
  });

  const newAccessToken = generateAccessToken(decoded.userId);
  const newRefreshToken = generateRefreshToken(decoded.userId);
  const newTokenHash = hashToken(newRefreshToken);

  await prisma.refreshToken.create({
    data: {
      userId: decoded.userId,
      tokenHash: newTokenHash,
    },
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

export const logoutService = async (rawRefreshToken: string) => {
  const tokenHash = hashToken(rawRefreshToken);
  await prisma.refreshToken.deleteMany({
    where: { tokenHash },
  });
};

export const findOrCreateGoogleUser = async (profile: {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}) => {
  // check if user exists with this Google ID
  let user = await prisma.user.findUnique({
    where: { googleId: profile.googleId },
  });

  if (!user) {
    // check if email exists (user registered with email before)
    user = await prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (user) {
      // link Google ID to existing account
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: profile.googleId },
      });
    } else {
      // create new user
      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          googleId: profile.googleId,
          avatarUrl: profile.avatarUrl,
        },
      });
    }
  }

  return user;
};
