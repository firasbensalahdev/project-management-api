import {
  getMyProfileService,
  updateMyProfileService,
} from "../../services/user.service";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";

jest.mock("../../config/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const mockUser = prisma.user as jest.Mocked<typeof prisma.user>;

const mockUserData = {
  id: 1,
  email: "test@test.com",
  name: "Test User",
  avatarUrl: null,
  createdAt: new Date(),
};

describe("getMyProfileService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return user profile", async () => {
    mockUser.findUnique.mockResolvedValue(mockUserData as any);

    const result = await getMyProfileService(1);

    expect(result).toEqual(mockUserData);
    expect(mockUser.findUnique).toHaveBeenCalledWith({
      where: { id: 1, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
  });

  it("should throw 404 if user not found", async () => {
    mockUser.findUnique.mockResolvedValue(null);

    await expect(getMyProfileService(99)).rejects.toThrow(
      new AppError("User not found", 404),
    );
  });
});

describe("updateMyProfileService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should update user name successfully", async () => {
    mockUser.findFirst.mockResolvedValue(null);
    mockUser.update.mockResolvedValue({
      ...mockUserData,
      name: "Updated Name",
    } as any);

    const result = await updateMyProfileService(1, { name: "Updated Name" });

    expect(result.name).toBe("Updated Name");
    expect(mockUser.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: "Updated Name" },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
  });

  it("should throw 409 if email already in use by another user", async () => {
    mockUser.findFirst.mockResolvedValue({
      id: 2,
      email: "taken@test.com",
    } as any);

    await expect(
      updateMyProfileService(1, { email: "taken@test.com" }),
    ).rejects.toThrow(new AppError("Email already in use", 409));
  });

  it("should update email if not taken", async () => {
    mockUser.findFirst.mockResolvedValue(null);
    mockUser.update.mockResolvedValue({
      ...mockUserData,
      email: "new@test.com",
    } as any);

    const result = await updateMyProfileService(1, {
      email: "new@test.com",
    });

    expect(result.email).toBe("new@test.com");
  });
});
