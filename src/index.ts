import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { errorHandler } from "./middleware/error.middleware";
import { prisma } from "./config/prisma";
import { connectMongo } from "./config/mongoose";
import { redis } from "./config/redis";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
import healthRoutes from "./routes/v1/health.routes";
import { passport } from "./config/passport";
import authRoutes from "./routes/v1/auth.routes";
import userRoutes from "./routes/v1/user.routes";
import workspaceRoutes from "./routes/v1/workspace.routes";
import projectRoutes from "./routes/v1/project.routes";
import taskRoutes from "./routes/v1/task.routes";
import commentRoutes from "./routes/v1/comment.routes";
import { startEmailWorker } from "./workers/email.worker";
import { startActivityWorker } from "./workers/activity.worker";

const app = express();

// security middleware
app.use(helmet());
app.use(
  cors({
    origin: env.ALLOWED_ORIGINS.split(","),
    credentials: true,
  }),
);

app.use(passport.initialize());

// swagger docs
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/v1", healthRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/workspaces", workspaceRoutes);
app.use("/api/v1/workspaces/:workspaceId/projects", projectRoutes);
app.use("/api/v1/projects", projectRoutes);
app.use("/api/v1/projects/:projectId/tasks", taskRoutes);
app.use("/api/v1/tasks", taskRoutes);
app.use("/api/v1/tasks/:taskId/comments", commentRoutes);
app.use("/api/v1/comments", commentRoutes);

app.use(errorHandler);

const start = async () => {
  try {
    await prisma.$connect();
    logger.info("PostgreSQL connected");

    await connectMongo();
    await redis.ping();

    startEmailWorker();
    startActivityWorker();

    app.listen(env.PORT, () => {
      logger.info(`Server running on http://localhost:${env.PORT}`);
    });
  } catch (error) {
    logger.error(error);
    process.exit(1);
  }
};

start();
