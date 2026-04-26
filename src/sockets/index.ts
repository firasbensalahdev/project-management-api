import { Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { verifyAccessToken } from "../utils/tokens";
import { prisma } from "../config/prisma";
import { logger } from "../utils/logger";
import { socketPubRedis, socketSubRedis } from "../config/redis";

export let io: SocketServer;

export const initializeSocket = (httpServer: HttpServer): SocketServer => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(","),
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // use Redis adapter for multi-instance broadcasting
  io.adapter(createAdapter(socketPubRedis, socketSubRedis));

  // JWT authentication middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.split(" ")[1];

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = verifyAccessToken(token);

      // verify user exists
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, name: true, email: true },
      });

      if (!user) {
        return next(new Error("User not found"));
      }

      // attach user to socket
      socket.data.userId = user.id;
      socket.data.userName = user.name;

      next();
    } catch (error) {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    logger.info(
      { userId: socket.data.userId, socketId: socket.id },
      "Client connected",
    );

    // join workspace room
    socket.on("join:workspace", async (workspaceId: number) => {
      try {
        // verify user is a member of this workspace
        const membership = await prisma.workspaceMember.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId,
              userId: socket.data.userId,
            },
          },
        });

        if (!membership) {
          socket.emit("error", { message: "Not a member of this workspace" });
          return;
        }

        const room = `workspace:${workspaceId}`;
        socket.join(room);
        logger.info(
          { userId: socket.data.userId, workspaceId, room },
          "Client joined workspace room",
        );

        socket.emit("joined:workspace", { workspaceId });
      } catch (error) {
        socket.emit("error", { message: "Failed to join workspace" });
      }
    });

    // leave workspace room
    socket.on("leave:workspace", (workspaceId: number) => {
      const room = `workspace:${workspaceId}`;
      socket.leave(room);
      logger.info(
        { userId: socket.data.userId, workspaceId },
        "Client left workspace room",
      );
    });

    socket.on("disconnect", (reason) => {
      logger.info(
        { userId: socket.data.userId, socketId: socket.id, reason },
        "Client disconnected",
      );
    });

    socket.on("error", (error) => {
      logger.error(
        { userId: socket.data.userId, error: error.message },
        "Socket error",
      );
    });
  });

  logger.info("Socket.io initialized");
  return io;
};

// helper to emit events to a workspace room
export const emitToWorkspace = (
  workspaceId: number,
  event: string,
  data: any,
) => {
  if (io) {
    io.to(`workspace:${workspaceId}`).emit(event, data);
  }
};
