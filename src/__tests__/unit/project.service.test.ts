import {
  createProjectService,
  getProjectByIdService,
  updateProjectService,
  deleteProjectService,
} from "../../services/project.service";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";

jest.mock("../../config/prisma", () => ({
  prisma: {
    project: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    workspace: {
      findUnique: jest.fn(),
    },
  },
}));

const mockProject = prisma.project as jest.Mocked<typeof prisma.project>;
const mockWorkspace = prisma.workspace as jest.Mocked<typeof prisma.workspace>;

const mockProjectData = {
  id: 1,
  name: "Test Project",
  description: "Test description",
  workspaceId: 1,
  createdAt: new Date(),
  deletedAt: null,
  _count: { tasks: 0 },
};

describe("createProjectService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should create a project successfully", async () => {
    mockWorkspace.findUnique.mockResolvedValue({ id: 1 } as any);
    mockProject.create.mockResolvedValue(mockProjectData as any);

    const result = await createProjectService(1, {
      name: "Test Project",
      description: "Test description",
    });

    expect(result.name).toBe("Test Project");
    expect(mockProject.create).toHaveBeenCalledWith({
      data: {
        name: "Test Project",
        description: "Test description",
        workspaceId: 1,
      },
    });
  });

  it("should throw 404 if workspace not found", async () => {
    mockWorkspace.findUnique.mockResolvedValue(null);

    await expect(createProjectService(99, { name: "Test" })).rejects.toThrow(
      new AppError("Workspace not found", 404),
    );
  });
});

describe("getProjectByIdService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return project by id", async () => {
    mockProject.findUnique.mockResolvedValue(mockProjectData as any);

    const result = await getProjectByIdService(1);

    expect(result.id).toBe(1);
    expect(result.name).toBe("Test Project");
  });

  it("should throw 404 if project not found", async () => {
    mockProject.findUnique.mockResolvedValue(null);

    await expect(getProjectByIdService(99)).rejects.toThrow(
      new AppError("Project not found", 404),
    );
  });
});

describe("updateProjectService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should update project", async () => {
    mockProject.findUnique.mockResolvedValue(mockProjectData as any);
    mockProject.update.mockResolvedValue({
      ...mockProjectData,
      name: "Updated Project",
    } as any);

    const result = await updateProjectService(1, { name: "Updated Project" });

    expect(result.name).toBe("Updated Project");
  });

  it("should throw 404 if project not found", async () => {
    mockProject.findUnique.mockResolvedValue(null);

    await expect(updateProjectService(99, { name: "Test" })).rejects.toThrow(
      new AppError("Project not found", 404),
    );
  });
});

describe("deleteProjectService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should soft delete project", async () => {
    mockProject.findUnique.mockResolvedValue(mockProjectData as any);
    mockProject.update.mockResolvedValue({} as any);

    await deleteProjectService(1);

    expect(mockProject.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it("should throw 404 if project not found", async () => {
    mockProject.findUnique.mockResolvedValue(null);

    await expect(deleteProjectService(99)).rejects.toThrow(
      new AppError("Project not found", 404),
    );
  });
});
