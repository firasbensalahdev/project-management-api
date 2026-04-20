import {
  createWorkspaceService,
  getMyWorkspacesService,
  updateWorkspaceService,
  deleteWorkspaceService,
  inviteMemberService,
  removeMemberService,
} from "../../services/workspace.service";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";

jest.mock("../../config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    workspace: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    workspaceMember: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

const mockWorkspace = prisma.workspace as jest.Mocked<typeof prisma.workspace>;
const mockMember = prisma.workspaceMember as jest.Mocked<
  typeof prisma.workspaceMember
>;
const mockUser = prisma.user as jest.Mocked<typeof prisma.user>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

const mockWorkspaceData = {
  id: 1,
  name: "Test Workspace",
  ownerId: 1,
  createdAt: new Date(),
  deletedAt: null,
};

describe("createWorkspaceService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should create workspace and add creator as owner", async () => {
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      return fn({
        workspace: { create: jest.fn().mockResolvedValue(mockWorkspaceData) },
        workspaceMember: { create: jest.fn().mockResolvedValue({}) },
      });
    });

    const result = await createWorkspaceService(1, { name: "Test Workspace" });

    expect(result).toEqual(mockWorkspaceData);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });
});

describe("updateWorkspaceService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should update workspace name", async () => {
    mockWorkspace.findUnique.mockResolvedValue(mockWorkspaceData as any);
    mockWorkspace.update.mockResolvedValue({
      ...mockWorkspaceData,
      name: "Updated Name",
    } as any);

    const result = await updateWorkspaceService(1, { name: "Updated Name" });

    expect(result.name).toBe("Updated Name");
  });

  it("should throw 404 if workspace not found", async () => {
    mockWorkspace.findUnique.mockResolvedValue(null);

    await expect(updateWorkspaceService(99, { name: "Test" })).rejects.toThrow(
      new AppError("Workspace not found", 404),
    );
  });
});

describe("deleteWorkspaceService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should soft delete workspace", async () => {
    mockWorkspace.findUnique.mockResolvedValue(mockWorkspaceData as any);
    mockWorkspace.update.mockResolvedValue({} as any);

    await deleteWorkspaceService(1);

    expect(mockWorkspace.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it("should throw 404 if workspace not found", async () => {
    mockWorkspace.findUnique.mockResolvedValue(null);

    await expect(deleteWorkspaceService(99)).rejects.toThrow(
      new AppError("Workspace not found", 404),
    );
  });
});

describe("inviteMemberService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should invite a new member", async () => {
    mockUser.findUnique.mockResolvedValue({
      id: 2,
      email: "user@test.com",
    } as any);
    mockMember.findUnique.mockResolvedValue(null);
    mockMember.create.mockResolvedValue({
      id: 1,
      workspaceId: 1,
      userId: 2,
      role: "member",
      user: { id: 2, name: "User", email: "user@test.com", avatarUrl: null },
    } as any);

    const result = await inviteMemberService(1, {
      email: "user@test.com",
      role: "member",
    });

    expect(result.role).toBe("member");
    expect(mockMember.create).toHaveBeenCalled();
  });

  it("should throw 404 if user not found", async () => {
    mockUser.findUnique.mockResolvedValue(null);

    await expect(
      inviteMemberService(1, { email: "nobody@test.com", role: "member" }),
    ).rejects.toThrow(new AppError("User not found", 404));
  });

  it("should throw 409 if user already a member", async () => {
    mockUser.findUnique.mockResolvedValue({ id: 2 } as any);
    mockMember.findUnique.mockResolvedValue({ id: 1 } as any);

    await expect(
      inviteMemberService(1, { email: "user@test.com", role: "member" }),
    ).rejects.toThrow(new AppError("User is already a member", 409));
  });
});

describe("removeMemberService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should remove a member", async () => {
    mockMember.findUnique.mockResolvedValue({
      id: 1,
      role: "member",
    } as any);
    mockMember.delete.mockResolvedValue({} as any);

    await removeMemberService(1, 2, 1);

    expect(mockMember.delete).toHaveBeenCalled();
  });

  it("should throw 400 if removing yourself", async () => {
    await expect(removeMemberService(1, 1, 1)).rejects.toThrow(
      new AppError("You cannot remove yourself from the workspace", 400),
    );
  });

  it("should throw 400 if removing the owner", async () => {
    mockMember.findUnique.mockResolvedValue({
      id: 1,
      role: "owner",
    } as any);

    await expect(removeMemberService(1, 2, 1)).rejects.toThrow(
      new AppError("Cannot remove the workspace owner", 400),
    );
  });

  it("should throw 404 if member not found", async () => {
    mockMember.findUnique.mockResolvedValue(null);

    await expect(removeMemberService(1, 2, 1)).rejects.toThrow(
      new AppError("Member not found", 404),
    );
  });
});
