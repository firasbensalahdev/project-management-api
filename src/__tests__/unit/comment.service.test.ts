import {
  getCommentsService,
  createCommentService,
  deleteCommentService,
} from "../../services/comment.service";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";

jest.mock("../../config/prisma", () => ({
  prisma: {
    comment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    task: {
      findUnique: jest.fn(),
    },
  },
}));

const mockComment = prisma.comment as jest.Mocked<typeof prisma.comment>;
const mockTask = prisma.task as jest.Mocked<typeof prisma.task>;

const mockCommentData = {
  id: 1,
  content: "Test comment",
  taskId: 1,
  userId: 1,
  createdAt: new Date(),
  deletedAt: null,
  user: { id: 1, name: "User", email: "user@test.com", avatarUrl: null },
};

describe("getCommentsService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return comments for a task", async () => {
    mockTask.findUnique.mockResolvedValue({ id: 1 } as any);
    mockComment.findMany.mockResolvedValue([mockCommentData] as any);

    const result = await getCommentsService(1);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Test comment");
  });

  it("should throw 404 if task not found", async () => {
    mockTask.findUnique.mockResolvedValue(null);

    await expect(getCommentsService(99)).rejects.toThrow(
      new AppError("Task not found", 404),
    );
  });
});

describe("createCommentService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should create a comment successfully", async () => {
    mockTask.findUnique.mockResolvedValue({ id: 1 } as any);
    mockComment.create.mockResolvedValue(mockCommentData as any);

    const result = await createCommentService(1, 1, {
      content: "Test comment",
    });

    expect(result.content).toBe("Test comment");
    expect(mockComment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: "Test comment",
          taskId: 1,
          userId: 1,
        }),
      }),
    );
  });

  it("should throw 404 if task not found", async () => {
    mockTask.findUnique.mockResolvedValue(null);

    await expect(
      createCommentService(99, 1, { content: "Test" }),
    ).rejects.toThrow(new AppError("Task not found", 404));
  });
});

describe("deleteCommentService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should soft delete comment as owner", async () => {
    mockComment.findUnique.mockResolvedValue(mockCommentData as any);
    mockComment.update.mockResolvedValue({} as any);

    await deleteCommentService(1, 1, "owner");

    expect(mockComment.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it("should allow member to delete their own comment", async () => {
    mockComment.findUnique.mockResolvedValue(mockCommentData as any);
    mockComment.update.mockResolvedValue({} as any);

    await deleteCommentService(1, 1, "member");

    expect(mockComment.update).toHaveBeenCalled();
  });

  it("should throw 403 if member tries to delete someone elses comment", async () => {
    mockComment.findUnique.mockResolvedValue({
      ...mockCommentData,
      userId: 2,
    } as any);

    await expect(deleteCommentService(1, 1, "member")).rejects.toThrow(
      new AppError("You can only delete your own comments", 403),
    );
  });

  it("should throw 404 if comment not found", async () => {
    mockComment.findUnique.mockResolvedValue(null);

    await expect(deleteCommentService(99, 1, "owner")).rejects.toThrow(
      new AppError("Comment not found", 404),
    );
  });
});
