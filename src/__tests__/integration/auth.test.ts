import request from "supertest";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { prisma } from "../../config/prisma";
import { errorHandler } from "../../middleware/error.middleware";
import authRoutes from "../../routes/v1/auth.routes";
import { passport } from "../../config/passport";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(passport.initialize());
app.use("/api/v1/auth", authRoutes);
app.use(errorHandler);

beforeAll(async () => {
  await prisma.$connect();
  // clean up test data
  await prisma.refreshToken.deleteMany({
    where: { user: { email: "authtest@test.com" } },
  });
  await prisma.user.deleteMany({
    where: { email: "authtest@test.com" },
  });
});

afterAll(async () => {
  await prisma.refreshToken.deleteMany({
    where: { user: { email: "authtest@test.com" } },
  });
  await prisma.user.deleteMany({
    where: { email: "authtest@test.com" },
  });
  await prisma.$disconnect();
});

let refreshToken: string;
let accessToken: string;

describe("POST /api/v1/auth/register", () => {
  it("should register a new user", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: "authtest@test.com",
      password: "123456",
      name: "Auth Test User",
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("email", "authtest@test.com");
    expect(res.body.data).not.toHaveProperty("password");
  });

  it("should return 409 if email already exists", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: "authtest@test.com",
      password: "123456",
      name: "Auth Test User",
    });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Email already in use");
  });

  it("should return 400 if email is invalid", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: "notanemail",
      password: "123456",
      name: "Test",
    });
    expect(res.status).toBe(400);
  });

  it("should return 400 if password is too short", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: "new@test.com",
      password: "123",
      name: "Test",
    });
    expect(res.status).toBe(400);
  });

  it("should return 400 if name is missing", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: "new@test.com",
      password: "123456",
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/auth/login", () => {
  it("should login and return tokens", async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const res = await request(app).post("/api/v1/auth/login").send({
      email: "authtest@test.com",
      password: "123456",
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("accessToken");
    expect(res.body.data).toHaveProperty("refreshToken");
    expect(res.body.data.user).toHaveProperty("email", "authtest@test.com");
    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  it("should return 401 for wrong password", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({
      email: "authtest@test.com",
      password: "wrongpassword",
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid credentials");
  });

  it("should return 401 for non existent email", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({
      email: "nobody@test.com",
      password: "123456",
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/auth/refresh", () => {
  it("should return new tokens", async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("accessToken");
    expect(res.body.data).toHaveProperty("refreshToken");
    refreshToken = res.body.data.refreshToken;
  });

  it("should return 401 for invalid refresh token", async () => {
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: "invalidtoken" });
    expect(res.status).toBe(401);
  });

  it("should return 400 if refresh token missing", async () => {
    const res = await request(app).post("/api/v1/auth/refresh").send({});
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("should logout successfully", async () => {
    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Logged out successfully");
  });

  it("should return 401 if no access token provided", async () => {
    const res = await request(app)
      .post("/api/v1/auth/logout")
      .send({ refreshToken });
    expect(res.status).toBe(401);
  });

  it("should return 400 if refresh token missing", async () => {
    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});
    expect(res.status).toBe(400);
  });
});
