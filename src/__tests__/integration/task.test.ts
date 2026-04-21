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
import { passport } from "../../config/passport";

jest.mock("../../utils/uploadImage", () => ({
  uploadToS3: jest
    .fn()
    .mockResolvedValue(
      "https://mock-bucket.s3.amazonaws.com/attachments/mock.jpg",
    ),
  deleteFromS3: jest.fn().mockResolvedValue(undefined),
  validateFile: jest.fn(),
}));

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
app.use(errorHandler);

let ownerToken: string;
let projectId: number;
let taskId: number;

beforeAll(async () => {
  await prisma.$connect();

  await prisma.task.deleteMany({
    where: {
      project: {
        workspace: { owner: { email: "taskowner@test.com" } },
      },
    },
  });
  await prisma.project.deleteMany({
    where: { workspace: { owner: { email: "taskowner@test.com" } } },
  });
  await prisma.workspaceMember.deleteMany({
    where: { workspace: { owner: { email: "taskowner@test.com" } } },
  });
  await prisma.workspace.deleteMany({
    where: { owner: { email: "taskowner@test.com" } },
  });
  await prisma.refreshToken.deleteMany({
    where: { user: { email: "taskowner@test.com" } },
  });
  await prisma.user.deleteMany({
    where: { email: "taskowner@test.com" },
  });

  await request(app).post("/api/v1/auth/register").send({
    email: "taskowner@test.com",
    password: "123456",
    name: "Task Owner",
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const loginRes = await request(app).post("/api/v1/auth/login").send({
    email: "taskowner@test.com",
    password: "123456",
  });
  ownerToken = loginRes.body.data.accessToken;

  const wsRes = await request(app)
    .post("/api/v1/workspaces")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name: "Task Workspace" });

  const projRes = await request(app)
    .post(`/api/v1/workspaces/${wsRes.body.data.id}/projects`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name: "Task Project" });
  projectId = projRes.body.data.id;
});

afterAll(async () => {
  await prisma.task.deleteMany({
    where: {
      project: {
        workspace: { owner: { email: "taskowner@test.com" } },
      },
    },
  });
  await prisma.project.deleteMany({
    where: { workspace: { owner: { email: "taskowner@test.com" } } },
  });
  await prisma.workspaceMember.deleteMany({
    where: { workspace: { owner: { email: "taskowner@test.com" } } },
  });
  await prisma.workspace.deleteMany({
    where: { owner: { email: "taskowner@test.com" } },
  });
  await prisma.refreshToken.deleteMany({
    where: { user: { email: "taskowner@test.com" } },
  });
  await prisma.user.deleteMany({
    where: { email: "taskowner@test.com" },
  });
  await prisma.$disconnect();
});

describe("POST /api/v1/projects/:projectId/tasks", () => {
  it("should create a task", async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Fix login bug", description: "Auth is broken" });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("title", "Fix login bug");
    taskId = res.body.data.id;
  });

  it("should return 400 if title is missing", async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("should return 401 if no token", async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .send({ title: "Test" });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/projects/:projectId/tasks", () => {
  it("should return paginated tasks", async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("hasMore");
    expect(res.body).toHaveProperty("nextCursor");
    expect(res.body).toHaveProperty("total");
  });

  it("should filter tasks by status", async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/tasks?status=todo`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((t: any) => t.status === "todo")).toBe(true);
  });

  it("should return 401 if no token", async () => {
    const res = await request(app).get(`/api/v1/projects/${projectId}/tasks`);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/tasks/:id", () => {
  it("should return task by id", async () => {
    const res = await request(app)
      .get(`/api/v1/tasks/${taskId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("id", taskId);
  });

  it("should return 404 for non existent task", async () => {
    const res = await request(app)
      .get("/api/v1/tasks/99999")
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/v1/tasks/:id", () => {
  it("should update a task", async () => {
    const res = await request(app)
      .put(`/api/v1/tasks/${taskId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Updated Task" });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("title", "Updated Task");
  });

  it("should return 404 for non existent task", async () => {
    const res = await request(app)
      .put("/api/v1/tasks/99999")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Test" });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/v1/tasks/:id/status", () => {
  it("should update task status", async () => {
    const res = await request(app)
      .patch(`/api/v1/tasks/${taskId}/status`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ status: "in_progress" });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("status", "in_progress");
  });

  it("should return 400 for invalid status", async () => {
    const res = await request(app)
      .patch(`/api/v1/tasks/${taskId}/status`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ status: "invalid" });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/v1/tasks/:id/assign", () => {
  it("should assign task to user", async () => {
    const user = await prisma.user.findUnique({
      where: { email: "taskowner@test.com" },
    });
    const res = await request(app)
      .patch(`/api/v1/tasks/${taskId}/assign`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ assignedToId: user!.id });
    expect(res.status).toBe(200);
    expect(res.body.data.assignedTo).toHaveProperty("id", user!.id);
  });

  it("should unassign task", async () => {
    const res = await request(app)
      .patch(`/api/v1/tasks/${taskId}/assign`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ assignedToId: null });
    expect(res.status).toBe(200);
    expect(res.body.data.assignedTo).toBeNull();
  });
});

describe("POST /api/v1/tasks/:id/attachment", () => {
  it("should upload attachment", async () => {
    const res = await request(app)
      .post(`/api/v1/tasks/${taskId}/attachment`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .attach("attachment", Buffer.from("fake-file"), {
        filename: "test.jpg",
        contentType: "image/jpeg",
      });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("attachmentUrl");
  });

  it("should return 400 if no file", async () => {
    const res = await request(app)
      .post(`/api/v1/tasks/${taskId}/attachment`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/v1/tasks/:id", () => {
  it("should soft delete a task", async () => {
    const res = await request(app)
      .delete(`/api/v1/tasks/${taskId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Task deleted successfully");
  });

  it("should return 404 for non existent task", async () => {
    const res = await request(app)
      .delete("/api/v1/tasks/99999")
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(404);
  });
});
