import request from "supertest";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { prisma } from "../../config/prisma";
import { errorHandler } from "../../middleware/error.middleware";
import authRoutes from "../../routes/v1/auth.routes";
import workspaceRoutes from "../../routes/v1/workspace.routes";
import projectRoutes from "../../routes/v1/project.routes";
import taskRoutes from "../../routes/v1/task.routes";
import commentRoutes from "../../routes/v1/comment.routes";
import { passport } from "../../config/passport";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(passport.initialize());
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/workspaces", workspaceRoutes);
app.use("/api/v1/workspaces/:workspaceId/projects", projectRoutes);
app.use("/api/v1/projects", projectRoutes);
app.use("/api/v1/projects/:projectId/tasks", taskRoutes);
app.use("/api/v1/tasks", taskRoutes);
app.use("/api/v1/tasks/:taskId/comments", commentRoutes);
app.use("/api/v1/comments", commentRoutes);
app.use(errorHandler);

let ownerToken: string;
let taskId: number;
let commentId: number;

beforeAll(async () => {
  await prisma.$connect();

  await prisma.comment.deleteMany({
    where: {
      task: {
        project: {
          workspace: { owner: { email: "commentowner@test.com" } },
        },
      },
    },
  });
  await prisma.task.deleteMany({
    where: {
      project: {
        workspace: { owner: { email: "commentowner@test.com" } },
      },
    },
  });
  await prisma.project.deleteMany({
    where: { workspace: { owner: { email: "commentowner@test.com" } } },
  });
  await prisma.workspaceMember.deleteMany({
    where: { workspace: { owner: { email: "commentowner@test.com" } } },
  });
  await prisma.workspace.deleteMany({
    where: { owner: { email: "commentowner@test.com" } },
  });
  await prisma.refreshToken.deleteMany({
    where: { user: { email: "commentowner@test.com" } },
  });
  await prisma.user.deleteMany({
    where: { email: "commentowner@test.com" },
  });

  await request(app).post("/api/v1/auth/register").send({
    email: "commentowner@test.com",
    password: "123456",
    name: "Comment Owner",
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const loginRes = await request(app).post("/api/v1/auth/login").send({
    email: "commentowner@test.com",
    password: "123456",
  });
  ownerToken = loginRes.body.data.accessToken;

  const wsRes = await request(app)
    .post("/api/v1/workspaces")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name: "Comment Workspace" });

  const projRes = await request(app)
    .post(`/api/v1/workspaces/${wsRes.body.data.id}/projects`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name: "Comment Project" });

  const taskRes = await request(app)
    .post(`/api/v1/projects/${projRes.body.data.id}/tasks`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ title: "Comment Task" });
  taskId = taskRes.body.data.id;
});

afterAll(async () => {
  await prisma.comment.deleteMany({
    where: {
      task: {
        project: {
          workspace: { owner: { email: "commentowner@test.com" } },
        },
      },
    },
  });
  await prisma.task.deleteMany({
    where: {
      project: {
        workspace: { owner: { email: "commentowner@test.com" } },
      },
    },
  });
  await prisma.project.deleteMany({
    where: { workspace: { owner: { email: "commentowner@test.com" } } },
  });
  await prisma.workspaceMember.deleteMany({
    where: { workspace: { owner: { email: "commentowner@test.com" } } },
  });
  await prisma.workspace.deleteMany({
    where: { owner: { email: "commentowner@test.com" } },
  });
  await prisma.refreshToken.deleteMany({
    where: { user: { email: "commentowner@test.com" } },
  });
  await prisma.user.deleteMany({
    where: { email: "commentowner@test.com" },
  });
  await prisma.$disconnect();
});

describe("POST /api/v1/tasks/:taskId/comments", () => {
  it("should create a comment", async () => {
    const res = await request(app)
      .post(`/api/v1/tasks/${taskId}/comments`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ content: "Looking into this" });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("content", "Looking into this");
    commentId = res.body.data.id;
  });

  it("should return 400 if content is empty", async () => {
    const res = await request(app)
      .post(`/api/v1/tasks/${taskId}/comments`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ content: "" });
    expect(res.status).toBe(400);
  });

  it("should return 404 if task not found", async () => {
    const res = await request(app)
      .post("/api/v1/tasks/99999/comments")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ content: "Test" });
    expect(res.status).toBe(404);
  });

  it("should return 401 if no token", async () => {
    const res = await request(app)
      .post(`/api/v1/tasks/${taskId}/comments`)
      .send({ content: "Test" });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/tasks/:taskId/comments", () => {
  it("should return all comments for a task", async () => {
    const res = await request(app)
      .get(`/api/v1/tasks/${taskId}/comments`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it("should return 404 if task not found", async () => {
    const res = await request(app)
      .get("/api/v1/tasks/99999/comments")
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(404);
  });

  it("should return 401 if no token", async () => {
    const res = await request(app).get(`/api/v1/tasks/${taskId}/comments`);
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/v1/comments/:id", () => {
  it("should soft delete a comment", async () => {
    const res = await request(app)
      .delete(`/api/v1/comments/${commentId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Comment deleted successfully");
  });

  it("should return 404 for non existent comment", async () => {
    const res = await request(app)
      .delete("/api/v1/comments/99999")
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(404);
  });

  it("should return 401 if no token", async () => {
    const res = await request(app).delete(`/api/v1/comments/${commentId}`);
    expect(res.status).toBe(401);
  });
});
