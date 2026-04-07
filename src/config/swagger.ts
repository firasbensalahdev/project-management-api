import swaggerJsdoc from "swagger-jsdoc";
import { version } from "../../package.json";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Project Management API",
      version,
      description: `
        A production-grade real-time project management REST API.

        ## Features
        - JWT Authentication with refresh token rotation
        - Google OAuth2 social login
        - Workspace-based multi-tenant architecture
        - Role-based access control (owner/admin/member)
        - Real-time updates via WebSockets
        - Background job processing with BullMQ
        - File uploads to AWS S3
        - Email notifications via SendGrid
        - Cursor-based pagination
        - Idempotency keys for safe retries
      `,
    },
    servers: [
      {
        url: "http://localhost:3000/api/v1",
        description: "Local server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT access token",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string" },
          },
        },
        User: {
          type: "object",
          properties: {
            id: { type: "integer" },
            email: { type: "string", format: "email" },
            name: { type: "string" },
            avatarUrl: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Workspace: {
          type: "object",
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
            ownerId: { type: "integer" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Project: {
          type: "object",
          properties: {
            id: { type: "integer" },
            workspaceId: { type: "integer" },
            name: { type: "string" },
            description: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Task: {
          type: "object",
          properties: {
            id: { type: "integer" },
            projectId: { type: "integer" },
            title: { type: "string" },
            description: { type: "string", nullable: true },
            status: {
              type: "string",
              enum: ["todo", "in_progress", "done"],
            },
            assignedToId: { type: "integer", nullable: true },
            createdById: { type: "integer" },
            attachmentUrl: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Comment: {
          type: "object",
          properties: {
            id: { type: "integer" },
            taskId: { type: "integer" },
            userId: { type: "integer" },
            content: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        WorkspaceMember: {
          type: "object",
          properties: {
            id: { type: "integer" },
            workspaceId: { type: "integer" },
            userId: { type: "integer" },
            role: {
              type: "string",
              enum: ["owner", "admin", "member"],
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        ActivityLog: {
          type: "object",
          properties: {
            id: { type: "string" },
            workspaceId: { type: "integer" },
            userId: { type: "integer" },
            userName: { type: "string" },
            action: { type: "string" },
            entityType: { type: "string" },
            entityId: { type: "integer" },
            metadata: { type: "object" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        PaginatedResponse: {
          type: "object",
          properties: {
            data: { type: "array", items: {} },
            nextCursor: { type: "string", nullable: true },
            hasMore: { type: "boolean" },
            total: { type: "integer" },
          },
        },
      },
    },
    tags: [
      { name: "Auth", description: "Authentication endpoints" },
      { name: "Users", description: "User profile management" },
      { name: "Workspaces", description: "Workspace management" },
      { name: "Projects", description: "Project management" },
      { name: "Tasks", description: "Task management" },
      { name: "Comments", description: "Task comments" },
      { name: "Health", description: "Health check" },
    ],
  },
  apis: ["./src/routes/v1/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
