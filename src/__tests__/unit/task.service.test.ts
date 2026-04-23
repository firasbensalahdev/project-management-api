import {
  createTaskService,
  getTaskByIdService,
  updateTaskService,
  deleteTaskService,
  updateTaskStatusService,
  assignTaskService,
} from "../../services/task.service";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";

jest.mock("../../config/prisma", () => ({
  prisma: {
    task: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("../../utils/activity", () => ({
  logActivity: jest.fn().mockResolvedValue(undefined),
}));

const mockTask = prisma.task as jest.Mocked<typeof prisma.task>;
const mockProject = prisma.project as jest.Mocked<typeof prisma.project>;

const mockTaskData = {
  id: 1,
  title: "Test Task",
  description: "Test description",
  status: "todo",
  projectId: 1,
  createdById: 1,
  assignedToId: null,
  attachmentUrl: null,
  createdAt: new Date(),
  deletedAt: null,
  assignedTo: null,
  createdBy: { id: 1, name: "User", email: "user@test.com" },
  _count: { comments: 0 },
};

describe("createTaskService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should create a task successfully", async () => {
    mockProject.findUnique.mockResolvedValue({ id: 1 } as any);
    mockTask.create.mockResolvedValue(mockTaskData as any);

    const result = await createTaskService(
      1,
      1,
      { title: "Test Task" },
      1,
      "Test User",
    );

    expect(result.title).toBe("Test Task");
    expect(mockTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Test Task",
          projectId: 1,
          createdById: 1,
        }),
      }),
    );
  });

  it("should throw 404 if project not found", async () => {
    mockProject.findUnique.mockResolvedValue(null);

    await expect(
      createTaskService(99, 1, { title: "Test" }, 1, "Test User"),
    ).rejects.toThrow(new AppError("Project not found", 404));
  });
});

describe("getTaskByIdService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return task by id", async () => {
    mockTask.findUnique.mockResolvedValue(mockTaskData as any);

    const result = await getTaskByIdService(1);

    expect(result.id).toBe(1);
    expect(result.title).toBe("Test Task");
  });

  it("should throw 404 if task not found", async () => {
    mockTask.findUnique.mockResolvedValue(null);

    await expect(getTaskByIdService(99)).rejects.toThrow(
      new AppError("Task not found", 404),
    );
  });
});

describe("updateTaskService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should update task as owner", async () => {
    mockTask.findUnique.mockResolvedValue(mockTaskData as any);
    mockTask.update.mockResolvedValue({
      ...mockTaskData,
      title: "Updated Task",
    } as any);

    const result = await updateTaskService(
      1,
      1,
      { title: "Updated Task" },
      "owner",
    );

    expect(result.title).toBe("Updated Task");
  });

  it("should allow member to edit their own task", async () => {
    mockTask.findUnique.mockResolvedValue(mockTaskData as any);
    mockTask.update.mockResolvedValue({
      ...mockTaskData,
      title: "Updated",
    } as any);

    const result = await updateTaskService(
      1,
      1,
      { title: "Updated" },
      "member",
    );

    expect(result.title).toBe("Updated");
  });

  it("should throw 403 if member tries to edit someone elses task", async () => {
    mockTask.findUnique.mockResolvedValue({
      ...mockTaskData,
      createdById: 2,
    } as any);

    await expect(
      updateTaskService(1, 1, { title: "Hacked" }, "member"),
    ).rejects.toThrow(new AppError("You can only edit your own tasks", 403));
  });
});

describe("deleteTaskService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should soft delete task as owner", async () => {
    mockTask.findUnique.mockResolvedValue(mockTaskData as any);
    mockTask.update.mockResolvedValue({} as any);

    await deleteTaskService(1, 1, "owner");

    expect(mockTask.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it("should throw 403 if member tries to delete someone elses task", async () => {
    mockTask.findUnique.mockResolvedValue({
      ...mockTaskData,
      createdById: 2,
    } as any);

    await expect(deleteTaskService(1, 1, "member")).rejects.toThrow(
      new AppError("You can only delete your own tasks", 403),
    );
  });
});

describe("updateTaskStatusService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should update task status", async () => {
    mockTask.findUnique.mockResolvedValue(mockTaskData as any);
    mockTask.update.mockResolvedValue({
      ...mockTaskData,
      status: "in_progress",
    } as any);

    await updateTaskStatusService(1, "in_progress");

    expect(mockTask.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "in_progress" },
    });
  });
});

describe("assignTaskService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should assign task to user", async () => {
    mockTask.findUnique.mockResolvedValue(mockTaskData as any);
    mockTask.update.mockResolvedValue({
      ...mockTaskData,
      assignedToId: 2,
    } as any);

    await assignTaskService(1, 2);

    expect(mockTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: { assignedToId: 2 },
      }),
    );
  });

  it("should unassign task when assignedToId is null", async () => {
    mockTask.findUnique.mockResolvedValue(mockTaskData as any);
    mockTask.update.mockResolvedValue({
      ...mockTaskData,
      assignedToId: null,
    } as any);

    await assignTaskService(1, null);

    expect(mockTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { assignedToId: null },
      }),
    );
  });
});
