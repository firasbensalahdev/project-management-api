import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import {
  CreateProjectInput,
  UpdateProjectInput,
} from "../validators/project.validator";

export const getProjectsService = async (workspaceId: number) => {
  return prisma.project.findMany({
    where: { workspaceId, deletedAt: null },
    include: {
      _count: { select: { tasks: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const getProjectByIdService = async (projectId: number) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId, deletedAt: null },
    include: {
      _count: { select: { tasks: true } },
    },
  });
  if (!project) throw new AppError("Project not found", 404);
  return project;
};

export const createProjectService = async (
  workspaceId: number,
  input: CreateProjectInput,
) => {
  // verify workspace exists
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId, deletedAt: null },
  });
  if (!workspace) throw new AppError("Workspace not found", 404);

  return prisma.project.create({
    data: {
      name: input.name,
      description: input.description,
      workspaceId,
    },
  });
};

export const updateProjectService = async (
  projectId: number,
  input: UpdateProjectInput,
) => {
  await getProjectByIdService(projectId);

  return prisma.project.update({
    where: { id: projectId },
    data: input,
  });
};

export const deleteProjectService = async (projectId: number) => {
  await getProjectByIdService(projectId);

  await prisma.project.update({
    where: { id: projectId },
    data: { deletedAt: new Date() },
  });
};
