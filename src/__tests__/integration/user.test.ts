import request from "supertest";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { prisma } from "../../config/prisma";
import { errorHandler } from "../../middleware/error.middleware";
import authRoutes from "../../routes/v1/auth.routes";
import userRoutes from "../../routes/v1/user.routes";
import { passport } from "../../config/passport";

// mock S3 so we don't hit AWS in tests
jest.mock("../../utils/uploadImage", () => ({
  uploadToS3: jest
    .fn()
    .mockResolvedValue(
      "https://mock-bucket.s3.amazonaws.com/avatars/mock-avatar.jpg",
    ),
  deleteFromS3: jest.fn().mockResolvedValue(undefined),
  generatePresignedUrl: jest.fn().mockResolvedValue({
    uploadUrl:
      "https://mock-bucket.s3.amazonaws.com/avatars/mock.jpg?signed=true",
    fileUrl: "https://mock-bucket.s3.amazonaws.com/avatars/mock.jpg",
  }),
  validateFile: jest.fn(),
}));

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(passport.initialize());
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use(errorHandler);

let accessToken: string;

beforeAll(async () => {
  await prisma.$connect();

  await prisma.refreshToken.deleteMany({
    where: { user: { email: "usertest@test.com" } },
  });
  await prisma.user.deleteMany({
    where: { email: "usertest@test.com" },
  });

  // register and login to get token
  await request(app).post("/api/v1/auth/register").send({
    email: "usertest@test.com",
    password: "123456",
    name: "User Test",
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const loginRes = await request(app).post("/api/v1/auth/login").send({
    email: "usertest@test.com",
    password: "123456",
  });
  accessToken = loginRes.body.data.accessToken;
});

afterAll(async () => {
  await prisma.refreshToken.deleteMany({
    where: { user: { email: "usertest@test.com" } },
  });
  await prisma.user.deleteMany({
    where: { email: "usertest@test.com" },
  });
  await prisma.$disconnect();
});

describe("GET /api/v1/users/me", () => {
  it("should return my profile", async () => {
    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("email", "usertest@test.com");
    expect(res.body.data).not.toHaveProperty("password");
  });

  it("should return 401 if no token", async () => {
    const res = await request(app).get("/api/v1/users/me");
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/v1/users/me", () => {
  it("should update my name", async () => {
    const res = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Updated Name" });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("name", "Updated Name");
  });

  it("should return 400 if email is invalid", async () => {
    const res = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ email: "notanemail" });
    expect(res.status).toBe(400);
  });

  it("should return 401 if no token", async () => {
    const res = await request(app)
      .patch("/api/v1/users/me")
      .send({ name: "Test" });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/users/me/avatar", () => {
  it("should upload avatar successfully", async () => {
    const res = await request(app)
      .post("/api/v1/users/me/avatar")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("avatar", Buffer.from("fake-image-content"), {
        filename: "avatar.jpg",
        contentType: "image/jpeg",
      });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("avatarUrl");
  });

  it("should return 400 if no file provided", async () => {
    const res = await request(app)
      .post("/api/v1/users/me/avatar")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
  });

  it("should return 401 if no token", async () => {
    const res = await request(app).post("/api/v1/users/me/avatar");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/users/me/presigned-url", () => {
  it("should return presigned URL", async () => {
    const res = await request(app)
      .post("/api/v1/users/me/presigned-url")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ filename: "avatar.jpg", mimetype: "image/jpeg" });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("uploadUrl");
    expect(res.body.data).toHaveProperty("fileUrl");
  });

  it("should return 400 for invalid mimetype", async () => {
    const res = await request(app)
      .post("/api/v1/users/me/presigned-url")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ filename: "file.pdf", mimetype: "application/pdf" });
    expect(res.status).toBe(400);
  });

  it("should return 401 if no token", async () => {
    const res = await request(app)
      .post("/api/v1/users/me/presigned-url")
      .send({ filename: "avatar.jpg", mimetype: "image/jpeg" });
    expect(res.status).toBe(401);
  });
});
