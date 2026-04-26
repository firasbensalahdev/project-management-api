import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import { io as ioClient, Socket } from "socket.io-client";
import express from "express";
import { prisma } from "../../config/prisma";
import { initializeSocket } from "../../sockets";
import { generateAccessToken } from "../../utils/tokens";

const app = express();
const httpServer = createServer(app);

let io: SocketServer;
let clientSocket: Socket;
let testUserId: number;
let workspaceId: number;
let accessToken: string;

beforeAll(async () => {
  await prisma.$connect();

  // clean up
  await prisma.workspaceMember.deleteMany({
    where: { workspace: { owner: { email: "sockettest@test.com" } } },
  });
  await prisma.workspace.deleteMany({
    where: { owner: { email: "sockettest@test.com" } },
  });
  await prisma.refreshToken.deleteMany({
    where: { user: { email: "sockettest@test.com" } },
  });
  await prisma.user.deleteMany({
    where: { email: "sockettest@test.com" },
  });

  // create test user
  const user = await prisma.user.create({
    data: {
      email: "sockettest@test.com",
      password: "hashedpassword",
      name: "Socket Test User",
    },
  });
  testUserId = user.id;

  // create workspace with user as owner
  const workspace = await prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.create({
      data: { name: "Socket Test Workspace", ownerId: testUserId },
    });
    await tx.workspaceMember.create({
      data: { workspaceId: ws.id, userId: testUserId, role: "owner" },
    });
    return ws;
  });
  workspaceId = workspace.id;

  accessToken = generateAccessToken(testUserId);

  // initialize socket server on different port
  io = initializeSocket(httpServer);

  await new Promise<void>((resolve) => {
    httpServer.listen(3001, () => resolve());
  });
});

afterAll(async () => {
  clientSocket?.disconnect();
  io?.close();
  httpServer.close();

  await prisma.workspaceMember.deleteMany({
    where: { workspace: { owner: { email: "sockettest@test.com" } } },
  });
  await prisma.workspace.deleteMany({
    where: { owner: { email: "sockettest@test.com" } },
  });
  await prisma.refreshToken.deleteMany({
    where: { user: { email: "sockettest@test.com" } },
  });
  await prisma.user.deleteMany({
    where: { email: "sockettest@test.com" },
  });
  await prisma.$disconnect();
});

describe("Socket.io authentication", () => {
  it("should reject connection without token", (done) => {
    const socket = ioClient("http://localhost:3001", {
      auth: {},
      transports: ["websocket"],
    });

    socket.on("connect_error", (err) => {
      expect(err.message).toBe("Authentication required");
      socket.disconnect();
      done();
    });
  });

  it("should reject connection with invalid token", (done) => {
    const socket = ioClient("http://localhost:3001", {
      auth: { token: "invalid_token" },
      transports: ["websocket"],
    });

    socket.on("connect_error", (err) => {
      expect(err.message).toBe("Invalid or expired token");
      socket.disconnect();
      done();
    });
  });

  it("should connect with valid token", (done) => {
    clientSocket = ioClient("http://localhost:3001", {
      auth: { token: accessToken },
      transports: ["websocket"],
    });

    clientSocket.on("connect", () => {
      expect(clientSocket.connected).toBe(true);
      done();
    });

    clientSocket.on("connect_error", (err) => {
      done(err);
    });
  });
});

describe("Socket.io workspace rooms", () => {
  it("should join workspace room", (done) => {
    clientSocket.emit("join:workspace", workspaceId);

    clientSocket.on("joined:workspace", (data) => {
      expect(data.workspaceId).toBe(workspaceId);
      done();
    });
  });

  it("should reject joining workspace user is not member of", (done) => {
    clientSocket.emit("join:workspace", 99999);

    clientSocket.on("error", (data) => {
      expect(data.message).toBe("Not a member of this workspace");
      done();
    });
  });

  it("should leave workspace room", (done) => {
    clientSocket.emit("leave:workspace", workspaceId);
    setTimeout(() => done(), 100);
  });
});

describe("BullMQ queue tests", () => {
  it("should add job to email queue", async () => {
    const { emailQueue } = await import("../../queues/email.queue");

    const job = await emailQueue.add("workspace.invite", {
      type: "workspace.invite",
      data: {
        inviteeEmail: "test@test.com",
        inviteeName: "Test User",
        workspaceName: "Test Workspace",
        inviterName: "Owner",
        role: "member",
      },
    });

    expect(job.id).toBeDefined();
  });

  it("should add job to activity queue", async () => {
    const { activityQueue } = await import("../../queues/activity.queue");

    const job = await activityQueue.add("log.activity", {
      workspaceId: 1,
      userId: 1,
      userName: "Test User",
      action: "task.created",
      entityType: "task",
      entityId: 1,
      metadata: {},
    });

    expect(job.id).toBeDefined();
  });
});
