import {
  registerService,
  loginService,
  refreshService,
  logoutService,
} from "../../services/auth.service";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import * as tokens from "../../utils/tokens";
import bcrypt from "bcrypt";

// mock entire prisma module
jest.mock("../../config/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

jest.mock("bcrypt");
jest.mock("../../utils/tokens");

const mockUser = prisma.user as jest.Mocked<typeof prisma.user>;
const mockRefreshToken = prisma.refreshToken as jest.Mocked<
  typeof prisma.refreshToken
>;
const mockTokens = tokens as jest.Mocked<typeof tokens>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe("registerService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should register a new user successfully", async () => {
    mockUser.findUnique.mockResolvedValue(null);
    mockBcrypt.hash.mockResolvedValue("hashedpassword" as never);
    mockUser.create.mockResolvedValue({
      id: 1,
      email: "test@test.com",
      name: "Test User",
      createdAt: new Date(),
    } as any);

    const result = await registerService({
      email: "test@test.com",
      password: "123456",
      name: "Test User",
    });

    expect(result.email).toBe("test@test.com");
    expect(mockUser.findUnique).toHaveBeenCalledWith({
      where: { email: "test@test.com" },
    });
    expect(mockBcrypt.hash).toHaveBeenCalledWith("123456", 12);
  });

  it("should throw 409 if email already exists", async () => {
    mockUser.findUnique.mockResolvedValue({
      id: 1,
      email: "test@test.com",
    } as any);

    await expect(
      registerService({
        email: "test@test.com",
        password: "123456",
        name: "Test User",
      }),
    ).rejects.toThrow(new AppError("Email already in use", 409));
  });
});

describe("loginService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should login successfully and return tokens", async () => {
    mockUser.findUnique.mockResolvedValue({
      id: 1,
      email: "test@test.com",
      password: "hashedpassword",
      name: "Test User",
    } as any);
    mockBcrypt.compare.mockResolvedValue(true as never);
    mockTokens.generateAccessToken.mockReturnValue("access_token");
    mockTokens.generateRefreshToken.mockReturnValue("refresh_token");
    mockTokens.hashToken.mockReturnValue("hashed_token");
    mockRefreshToken.create.mockResolvedValue({} as any);

    const result = await loginService({
      email: "test@test.com",
      password: "123456",
    });

    expect(result.accessToken).toBe("access_token");
    expect(result.refreshToken).toBe("refresh_token");
    expect(result.user.email).toBe("test@test.com");
    expect(mockRefreshToken.create).toHaveBeenCalledWith({
      data: { userId: 1, tokenHash: "hashed_token" },
    });
  });

  it("should throw 401 if user not found", async () => {
    mockUser.findUnique.mockResolvedValue(null);

    await expect(
      loginService({ email: "nobody@test.com", password: "123456" }),
    ).rejects.toThrow(new AppError("Invalid credentials", 401));
  });

  it("should throw 401 if password does not match", async () => {
    mockUser.findUnique.mockResolvedValue({
      id: 1,
      email: "test@test.com",
      password: "hashedpassword",
    } as any);
    mockBcrypt.compare.mockResolvedValue(false as never);

    await expect(
      loginService({ email: "test@test.com", password: "wrongpassword" }),
    ).rejects.toThrow(new AppError("Invalid credentials", 401));
  });

  it("should throw 401 if user has no password (OAuth user)", async () => {
    mockUser.findUnique.mockResolvedValue({
      id: 1,
      email: "test@test.com",
      password: null,
    } as any);

    await expect(
      loginService({ email: "test@test.com", password: "123456" }),
    ).rejects.toThrow(new AppError("Invalid credentials", 401));
  });
});

describe("refreshService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should refresh tokens successfully", async () => {
    mockTokens.verifyRefreshToken.mockReturnValue({ userId: 1 });
    mockTokens.hashToken.mockReturnValue("hashed_token");
    mockRefreshToken.findUnique.mockResolvedValue({
      id: 1,
      tokenHash: "hashed_token",
      userId: 1,
    } as any);
    mockRefreshToken.delete.mockResolvedValue({} as any);
    mockTokens.generateAccessToken.mockReturnValue("new_access_token");
    mockTokens.generateRefreshToken.mockReturnValue("new_refresh_token");
    mockRefreshToken.create.mockResolvedValue({} as any);

    const result = await refreshService("raw_refresh_token");

    expect(result.accessToken).toBe("new_access_token");
    expect(result.refreshToken).toBe("new_refresh_token");
    expect(mockRefreshToken.delete).toHaveBeenCalled();
  });

  it("should throw 401 if token verification fails", async () => {
    mockTokens.verifyRefreshToken.mockImplementation(() => {
      throw new Error("Invalid token");
    });

    await expect(refreshService("invalid_token")).rejects.toThrow(
      new AppError("Invalid or expired refresh token", 401),
    );
  });

  it("should throw 401 if token not found in DB", async () => {
    mockTokens.verifyRefreshToken.mockReturnValue({ userId: 1 });
    mockTokens.hashToken.mockReturnValue("hashed_token");
    mockRefreshToken.findUnique.mockResolvedValue(null);

    await expect(refreshService("raw_refresh_token")).rejects.toThrow(
      new AppError("Invalid refresh token", 401),
    );
  });
});

describe("logoutService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should delete refresh token on logout", async () => {
    mockTokens.hashToken.mockReturnValue("hashed_token");
    mockRefreshToken.deleteMany.mockResolvedValue({ count: 1 } as any);

    await logoutService("raw_refresh_token");

    expect(mockRefreshToken.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: "hashed_token" },
    });
  });
});
