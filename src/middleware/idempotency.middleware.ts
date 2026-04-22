import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";
import { prisma } from "../config/prisma";
import { logger } from "../utils/logger";

export const idempotencyMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const idempotencyKey = req.headers["idempotency-key"] as string;

  if (!idempotencyKey) {
    return next();
  }

  try {
    // check if key already exists
    const existing = await prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    });

    if (existing) {
      // return cached result
      logger.info(
        { key: idempotencyKey },
        "Idempotency key hit — returning cached result",
      );
      return res.status(201).json(existing.result);
    }

    // intercept the response to cache it
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      // store result with expiry
      prisma.idempotencyKey
        .create({
          data: {
            key: idempotencyKey,
            userId: req.userId!,
            result: body,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          },
        })
        .catch((err) => {
          logger.error({ err }, "Failed to store idempotency key");
        });

      return originalJson(body);
    };

    next();
  } catch (error) {
    next(error);
  }
};
