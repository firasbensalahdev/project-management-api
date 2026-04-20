import request from "supertest";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { prisma } from "../../config/prisma";
import { errorHandler } from "../../middleware/error.middleware";
import authRoutes from "../../routes/v1/auth.routes";
import workspaceRoutes from "../../routes/v1/workspace.routes";
import projectRoutes from "../../routes/v1/project.routes";
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
app.use(errorHandler);

let ownerToken: string;
let workspaceId: number;
let projectId: number;

beforeAll(async () => {
  await prisma.$connect();

  await prisma.project.deleteMany({
    where: { workspace: { owner: { email: "projowner@test.com" } } },
  });
  await prisma.workspaceMember.deleteMany({
    where: { workspace: { owner: { email: "projowner@test.com" } } },
  });
  await prisma.workspace.deleteMany({
    where: { owner: { email: "projowner@test.com" } },
  });
  await prisma.refreshToken.deleteMany({
    where: { user: { email: "projowner@test.com" } },
  });
  await prisma.user.deleteMany({
    where: { email: "projowner@test.com" },
  });

  await request(app).post("/api/v1/auth/register").send({
    email: "projowner@test.com",
    password: "123456",
    name: "Project Owner",
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const loginRes = await request(app).post("/api/v1/auth/login").send({
    email: "projowner@test.com",
    password: "123456",
  });
  ownerToken = loginRes.body.data.accessToken;

  // create workspace
  const wsRes = await request(app)
    .post("/api/v1/workspaces")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name: "Test Workspace" });
  workspaceId = wsRes.body.data.id;
});

afterAll(async () => {
  await prisma.project.deleteMany({
    where: { workspace: { owner: { email: "projowner@test.com" } } },
  });
  await prisma.workspaceMember.deleteMany({
    where: { workspace: { owner: { email: "projowner@test.com" } } },
  });
  await prisma.workspace.deleteMany({
    where: { owner: { email: "projowner@test.com" } },
  });
  await prisma.refreshToken.deleteMany({
    where: { user: { email: "projowner@test.com" } },
  });
  await prisma.user.deleteMany({
    where: { email: "projowner@test.com" },
  });
  await prisma.$disconnect();
});

describe("POST /api/v1/workspaces/:workspaceId/projects", () => {
  it("should create a project", async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Backend", description: "Backend tasks" });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("name", "Backend");
    projectId = res.body.data.id;
  });

  it("should return 400 if name is missing", async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("should return 401 if no token", async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .send({ name: "Test" });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/workspaces/:workspaceId/projects", () => {
  it("should return all projects in workspace", async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/projects`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it("should return 401 if no token", async () => {
    const res = await request(app).get(
      `/api/v1/workspaces/${workspaceId}/projects`,
    );
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/projects/:id", () => {
  it("should return project by id", async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("id", projectId);
    expect(res.body.data).toHaveProperty("name", "Backend");
  });

  it("should return 404 for non existent project", async () => {
    const res = await request(app)
      .get("/api/v1/projects/99999")
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/v1/projects/:id", () => {
  it("should update a project", async () => {
    const res = await request(app)
      .put(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Updated Backend" });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("name", "Updated Backend");
  });

  it("should return 404 for non existent project", async () => {
    const res = await request(app)
      .put("/api/v1/projects/99999")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Test" });
    expect(res.status).toBe(404);
  });

  it("should return 401 if no token", async () => {
    const res = await request(app)
      .put(`/api/v1/projects/${projectId}`)
      .send({ name: "Test" });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/v1/projects/:id", () => {
  it("should soft delete a project", async () => {
    const res = await request(app)
      .delete(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Project deleted successfully");
  });

  it("should return 404 for non existent project", async () => {
    const res = await request(app)
      .delete("/api/v1/projects/99999")
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(404);
  });
});
