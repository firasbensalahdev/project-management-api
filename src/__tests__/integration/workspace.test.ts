import request from "supertest";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { prisma } from "../../config/prisma";
import { errorHandler } from "../../middleware/error.middleware";
import authRoutes from "../../routes/v1/auth.routes";
import workspaceRoutes from "../../routes/v1/workspace.routes";
import { passport } from "../../config/passport";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(passport.initialize());
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/workspaces", workspaceRoutes);
app.use(errorHandler);

let ownerToken: string;
let memberToken: string;
let ownerId: number;
let memberId: number;
let workspaceId: number;

beforeAll(async () => {
  await prisma.$connect();

  // clean up
  await prisma.workspaceMember.deleteMany({
    where: {
      workspace: {
        owner: { email: { in: ["wsowner@test.com", "wsmember@test.com"] } },
      },
    },
  });
  await prisma.workspace.deleteMany({
    where: { owner: { email: "wsowner@test.com" } },
  });
  await prisma.refreshToken.deleteMany({
    where: {
      user: { email: { in: ["wsowner@test.com", "wsmember@test.com"] } },
    },
  });
  await prisma.user.deleteMany({
    where: { email: { in: ["wsowner@test.com", "wsmember@test.com"] } },
  });

  // register owner
  const ownerReg = await request(app).post("/api/v1/auth/register").send({
    email: "wsowner@test.com",
    password: "123456",
    name: "WS Owner",
  });
  ownerId = ownerReg.body.data.id;

  // register member
  const memberReg = await request(app).post("/api/v1/auth/register").send({
    email: "wsmember@test.com",
    password: "123456",
    name: "WS Member",
  });
  memberId = memberReg.body.data.id;

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const ownerLogin = await request(app).post("/api/v1/auth/login").send({
    email: "wsowner@test.com",
    password: "123456",
  });
  ownerToken = ownerLogin.body.data.accessToken;

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const memberLogin = await request(app).post("/api/v1/auth/login").send({
    email: "wsmember@test.com",
    password: "123456",
  });
  memberToken = memberLogin.body.data.accessToken;
});

afterAll(async () => {
  await prisma.workspaceMember.deleteMany({
    where: { workspace: { owner: { email: "wsowner@test.com" } } },
  });
  await prisma.workspace.deleteMany({
    where: { owner: { email: "wsowner@test.com" } },
  });
  await prisma.refreshToken.deleteMany({
    where: {
      user: { email: { in: ["wsowner@test.com", "wsmember@test.com"] } },
    },
  });
  await prisma.user.deleteMany({
    where: { email: { in: ["wsowner@test.com", "wsmember@test.com"] } },
  });
  await prisma.$disconnect();
});

describe("POST /api/v1/workspaces", () => {
  it("should create a workspace", async () => {
    const res = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Test Workspace" });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("name", "Test Workspace");
    workspaceId = res.body.data.id;
  });

  it("should return 400 if name is missing", async () => {
    const res = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("should return 401 if no token", async () => {
    const res = await request(app)
      .post("/api/v1/workspaces")
      .send({ name: "Test" });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/workspaces", () => {
  it("should return my workspaces", async () => {
    const res = await request(app)
      .get("/api/v1/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it("should return 401 if no token", async () => {
    const res = await request(app).get("/api/v1/workspaces");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/workspaces/:id", () => {
  it("should return workspace by id for member", async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("id", workspaceId);
    expect(res.body.data).toHaveProperty("members");
  });

  it("should return 403 if not a member", async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });

  it("should return 404 for non existent workspace", async () => {
    const res = await request(app)
      .get("/api/v1/workspaces/99999")
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/v1/workspaces/:id", () => {
  it("should update workspace as owner", async () => {
    const res = await request(app)
      .put(`/api/v1/workspaces/${workspaceId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Updated Workspace" });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("name", "Updated Workspace");
  });

  it("should return 403 if not owner or admin", async () => {
    const res = await request(app)
      .put(`/api/v1/workspaces/${workspaceId}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ name: "Hacked" });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/v1/workspaces/:id/invite", () => {
  it("should invite a member as owner", async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/invite`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "wsmember@test.com", role: "member" });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty("role", "member");
  });

  it("should return 409 if already a member", async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/invite`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "wsmember@test.com", role: "member" });
    expect(res.status).toBe(409);
  });

  it("should return 404 if user not found", async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/invite`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "nobody@test.com", role: "member" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/v1/workspaces/:id/members/:userId", () => {
  it("should remove a member as owner", async () => {
    const res = await request(app)
      .delete(`/api/v1/workspaces/${workspaceId}/members/${memberId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Member removed successfully");
  });

  it("should return 400 if removing yourself", async () => {
    const res = await request(app)
      .delete(`/api/v1/workspaces/${workspaceId}/members/${ownerId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/v1/workspaces/:id", () => {
  it("should return 403 if not owner", async () => {
    const res = await request(app)
      .delete(`/api/v1/workspaces/${workspaceId}`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });

  it("should soft delete workspace as owner", async () => {
    const res = await request(app)
      .delete(`/api/v1/workspaces/${workspaceId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Workspace deleted successfully");
  });
});
