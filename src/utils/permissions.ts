import { prisma } from "../config/prisma";
import { AppError } from "./AppError";

export type WorkspaceRole = "owner" | "admin" | "member";

export type WorkspaceAction =
  | "delete_workspace"
  | "update_workspace"
  | "invite_member"
  | "remove_member"
  | "view_workspace"
  | "create_project"
  | "update_project"
  | "delete_project"
  | "create_task"
  | "edit_any_task"
  | "delete_any_task"
  | "view_activity";

// permission matrix — what each role can do
const permissions: Record<WorkspaceRole, WorkspaceAction[]> = {
  owner: [
    "delete_workspace",
    "update_workspace",
    "invite_member",
    "remove_member",
    "view_workspace",
    "create_project",
    "update_project",
    "delete_project",
    "create_task",
    "edit_any_task",
    "delete_any_task",
    "view_activity",
  ],
  admin: [
    "update_workspace",
    "invite_member",
    "remove_member",
    "view_workspace",
    "create_project",
    "update_project",
    "delete_project",
    "create_task",
    "edit_any_task",
    "delete_any_task",
    "view_activity",
  ],
  member: [
    "view_workspace",
    "create_project",
    "update_project",
    "delete_project",
    "create_task",
    "view_activity",
  ],
};

export const getUserWorkspaceRole = async (
  userId: number,
  workspaceId: number,
): Promise<WorkspaceRole | null> => {
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    select: { role: true },
  });

  if (!membership) return null;
  return membership.role as WorkspaceRole;
};

export const canPerformAction = (
  role: WorkspaceRole,
  action: WorkspaceAction,
): boolean => {
  return permissions[role].includes(action);
};

export const requireWorkspacePermission = async (
  userId: number,
  workspaceId: number,
  action: WorkspaceAction,
): Promise<WorkspaceRole> => {
  const role = await getUserWorkspaceRole(userId, workspaceId);

  if (!role) {
    throw new AppError("You are not a member of this workspace", 403);
  }

  if (!canPerformAction(role, action)) {
    throw new AppError(
      "You do not have permission to perform this action",
      403,
    );
  }

  return role;
};
