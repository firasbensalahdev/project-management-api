import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  InviteMemberInput,
} from "../validators/workspace.validator";
import { emailQueue } from "../queues/email.queue";
import { logActivity } from "../utils/activity";
import { emitToWorkspace } from "../sockets";

export const createWorkspaceService = async (
  userId: number,
  input: CreateWorkspaceInput,
) => {
  // create workspace and add creator as owner in one transaction
  const workspace = await prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.create({
      data: {
        name: input.name,
        ownerId: userId,
      },
    });

    await tx.workspaceMember.create({
      data: {
        workspaceId: ws.id,
        userId,
        role: "owner",
      },
    });

    return ws;
  });

  return workspace;
};

export const getMyWorkspacesService = async (userId: number) => {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: {
        include: {
          _count: {
            select: { members: true, projects: true },
          },
        },
      },
    },
  });

  return memberships
    .filter((m) => m.workspace.deletedAt === null)
    .map((m) => ({
      ...m.workspace,
      role: m.role,
    }));
};

export const getWorkspaceByIdService = async (
  workspaceId: number,
  userId: number,
) => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId, deletedAt: null },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      },
      _count: {
        select: { projects: true },
      },
    },
  });

  if (!workspace) throw new AppError("Workspace not found", 404);
  return workspace;
};

export const updateWorkspaceService = async (
  workspaceId: number,
  input: UpdateWorkspaceInput,
) => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId, deletedAt: null },
  });
  if (!workspace) throw new AppError("Workspace not found", 404);

  return prisma.workspace.update({
    where: { id: workspaceId },
    data: { name: input.name },
  });
};

export const deleteWorkspaceService = async (workspaceId: number) => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId, deletedAt: null },
  });
  if (!workspace) throw new AppError("Workspace not found", 404);

  // soft delete
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { deletedAt: new Date() },
  });
};

export const inviteMemberService = async (
  workspaceId: number,
  input: InviteMemberInput,
  inviter: { id: number; name: string },
) => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });
  if (!user) throw new AppError("User not found", 404);

  const existing = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  });
  if (existing) throw new AppError("User is already a member", 409);

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  });

  const member = await prisma.workspaceMember.create({
    data: { workspaceId, userId: user.id, role: input.role },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
  });

  // queue email job — non-blocking
  await emailQueue.add("workspace.invite", {
    type: "workspace.invite",
    data: {
      inviteeEmail: user.email,
      inviteeName: user.name,
      workspaceName: workspace?.name || "",
      inviterName: inviter.name,
      role: input.role,
    },
  });

  // log activity — non-blocking
  await logActivity({
    workspaceId,
    userId: inviter.id,
    userName: inviter.name,
    action: "member.invited",
    entityType: "member",
    entityId: user.id,
    metadata: { inviteeEmail: user.email, role: input.role },
  });

  // emit real-time event
  emitToWorkspace(workspaceId, "member:joined", {
    user: member.user,
    role: input.role,
  });

  return member;
};

export const removeMemberService = async (
  workspaceId: number,
  targetUserId: number,
  requestingUserId: number,
) => {
  // cannot remove yourself
  if (targetUserId === requestingUserId) {
    throw new AppError("You cannot remove yourself from the workspace", 400);
  }

  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: targetUserId,
      },
    },
  });
  if (!member) throw new AppError("Member not found", 404);

  // cannot remove the owner
  if (member.role === "owner") {
    throw new AppError("Cannot remove the workspace owner", 400);
  }

  await prisma.workspaceMember.delete({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: targetUserId,
      },
    },
  });
};

export const getWorkspaceActivityService = async (workspaceId: number) => {
  const { ActivityLog } = await import("../models/activityLog.model");

  return ActivityLog.find({ workspaceId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
};
