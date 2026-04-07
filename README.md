# Project Management API

A production-grade real-time project management REST API built with Node.js, TypeScript, and PostgreSQL.

## Live API

- **Base URL**: `coming soon`
- **API Documentation**: `coming soon`

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript
- **Framework**: Express.js
- **ORM**: Prisma
- **Database**: PostgreSQL (relational data) + MongoDB (activity logs)
- **Cache**: Redis
- **Real-time**: Socket.io (JWT authenticated)
- **Auth**: JWT (access + refresh tokens with rotation) + Google OAuth2
- **Background Jobs**: BullMQ (email + activity logging)
- **Storage**: AWS S3 (pre-signed URLs)
- **Email**: SendGrid
- **Docs**: Swagger UI
- **Logging**: Pino (structured JSON)
- **Testing**: Jest + Supertest + Istanbul (80% coverage enforced)
- **CI/CD**: GitHub Actions
- **Deployment**: AWS EC2 + RDS + ElastiCache

## Getting Started

### Prerequisites

- Node.js 20+
- Docker Desktop

### Run with Docker (recommended)

```bash
git clone https://github.com/FirasBS/project-management-api
cd project-management-api
cp .env.example .env
docker compose up --build
```

### Run locally

```bash
npm install
npx prisma migrate dev
npm run dev
```

## API Documentation

Full interactive documentation available at:
`http://localhost:3000/api-docs`

## Environment Variables

See `.env.example` for all required variables.

## API Endpoints

### Auth

| Method | Endpoint                     | Access | Description                 |
| ------ | ---------------------------- | ------ | --------------------------- |
| POST   | /api/v1/auth/register        | Public | Register a new user         |
| POST   | /api/v1/auth/login           | Public | Login and get tokens        |
| POST   | /api/v1/auth/refresh         | Public | Refresh access token        |
| POST   | /api/v1/auth/logout          | Auth   | Logout and invalidate token |
| GET    | /api/v1/auth/google          | Public | Google OAuth2 redirect      |
| GET    | /api/v1/auth/google/callback | Public | Google OAuth2 callback      |

### Users

| Method | Endpoint                       | Access | Description           |
| ------ | ------------------------------ | ------ | --------------------- |
| GET    | /api/v1/users/me               | Auth   | Get my profile        |
| PATCH  | /api/v1/users/me               | Auth   | Update my profile     |
| POST   | /api/v1/users/me/avatar        | Auth   | Upload avatar to S3   |
| GET    | /api/v1/users/me/presigned-url | Auth   | Get S3 pre-signed URL |

### Workspaces

| Method | Endpoint                               | Access      | Description             |
| ------ | -------------------------------------- | ----------- | ----------------------- |
| GET    | /api/v1/workspaces                     | Auth        | Get my workspaces       |
| POST   | /api/v1/workspaces                     | Auth        | Create workspace        |
| GET    | /api/v1/workspaces/:id                 | Member      | Get workspace           |
| PUT    | /api/v1/workspaces/:id                 | Owner       | Update workspace        |
| DELETE | /api/v1/workspaces/:id                 | Owner       | Delete workspace (soft) |
| POST   | /api/v1/workspaces/:id/invite          | Owner/Admin | Invite member via email |
| DELETE | /api/v1/workspaces/:id/members/:userId | Owner/Admin | Remove member           |
| GET    | /api/v1/workspaces/:id/activity        | Member      | Get activity logs       |

### Projects

| Method | Endpoint                        | Access | Description           |
| ------ | ------------------------------- | ------ | --------------------- |
| GET    | /api/v1/workspaces/:id/projects | Member | List projects         |
| POST   | /api/v1/workspaces/:id/projects | Member | Create project        |
| GET    | /api/v1/projects/:id            | Member | Get project           |
| PUT    | /api/v1/projects/:id            | Member | Update project        |
| DELETE | /api/v1/projects/:id            | Member | Delete project (soft) |

### Tasks

| Method | Endpoint                        | Access | Description                              |
| ------ | ------------------------------- | ------ | ---------------------------------------- |
| GET    | /api/v1/projects/:id/tasks      | Member | List tasks (cursor pagination + filters) |
| POST   | /api/v1/projects/:id/tasks      | Member | Create task (idempotency key)            |
| GET    | /api/v1/tasks/:id               | Member | Get task                                 |
| PUT    | /api/v1/tasks/:id               | Member | Update task                              |
| DELETE | /api/v1/tasks/:id               | Member | Delete task (soft)                       |
| PATCH  | /api/v1/tasks/:id/assign        | Member | Assign task to user                      |
| PATCH  | /api/v1/tasks/:id/status        | Member | Update task status                       |
| POST   | /api/v1/tasks/:id/attachment    | Member | Upload attachment to S3                  |
| GET    | /api/v1/tasks/:id/presigned-url | Member | Get S3 pre-signed URL                    |

### Comments

| Method | Endpoint                   | Access | Description           |
| ------ | -------------------------- | ------ | --------------------- |
| GET    | /api/v1/tasks/:id/comments | Member | Get comments          |
| POST   | /api/v1/tasks/:id/comments | Member | Add comment           |
| DELETE | /api/v1/comments/:id       | Member | Delete comment (soft) |

### Health

| Method | Endpoint       | Access | Description  |
| ------ | -------------- | ------ | ------------ |
| GET    | /api/v1/health | Public | Health check |

## Roles

| Role     | Description                                             |
| -------- | ------------------------------------------------------- |
| `owner`  | Created the workspace — full control including deletion |
| `admin`  | Can invite/remove members and edit any task             |
| `member` | Can create tasks and edit their own tasks               |

## Project Structure

```
src/
├── config/         → DB, Redis, S3, Swagger, env validation
├── controllers/    → HTTP request handling only
├── services/       → All business logic
├── routes/
│   └── v1/         → Versioned route definitions + Swagger docs
├── middleware/     → Auth, RBAC, idempotency, error, rate limiting
├── queues/         → BullMQ queue definitions
├── workers/        → BullMQ job processors
├── models/         → MongoDB/Mongoose models
├── validators/     → Zod request schemas
├── utils/          → Logger, AppError, S3 upload, permissions
├── sockets/        → Socket.io gateway with JWT auth
└── index.ts        → App entry point
```

## Architecture

```
Request → Middleware → Controller → Service → Prisma → PostgreSQL
                                            → Redis (cache)
                                            → BullMQ → Worker → SendGrid
                                                              → MongoDB
                                            → Socket.io → Clients
```

- **Controllers** — HTTP only, parse request, call service, return response
- **Services** — all business logic, no HTTP concerns
- **Middleware** — auth, RBAC, rate limiting, idempotency, error handling
- **Workers** — background job processors running independently

## Authentication

- **Access Token** — short-lived (15 min), sent with every request in Authorization header
- **Refresh Token** — long-lived (7 days), hashed with SHA-256 before storing in DB
- **Token Rotation** — every refresh issues a new token and invalidates the old one
- **Google OAuth2** — social login via Passport.js

## Real-time Events

WebSocket events broadcast to workspace rooms (JWT authenticated):

| Event                 | Trigger                     |
| --------------------- | --------------------------- |
| `task:created`        | New task created in project |
| `task:updated`        | Task fields changed         |
| `task:assigned`       | Task assigned to user       |
| `task:status_changed` | Task status updated         |
| `comment:added`       | New comment on task         |
| `member:joined`       | New member joined workspace |

## Background Jobs

| Queue          | Job              | Description                       |
| -------------- | ---------------- | --------------------------------- |
| email-queue    | workspace.invite | Send workspace invitation email   |
| email-queue    | task.assigned    | Send task assignment notification |
| activity-queue | log.activity     | Write activity log to MongoDB     |

All jobs retry 3 times with exponential backoff. Failed jobs move to a dead letter queue.

## Running Tests

```bash
npm test
npm run test:cov  # with coverage report
```

Coverage minimum: 80% enforced in CI.

## CI/CD Pipeline

```
Push to any branch  → GitHub Actions runs full test suite
Push to main        → tests pass → auto deploy to AWS EC2
```

Branch strategy:

```
feature/* → dev → staging → main
```

## Releases

| Version | Description                                                         |
| ------- | ------------------------------------------------------------------- |
| v0.1.0  | Foundation — Express setup, Docker, Prisma, MongoDB, Redis, Swagger |

## Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
feat:     new feature
fix:      bug fix
chore:    config or dependency changes
test:     adding or updating tests
docs:     documentation changes
refactor: code restructuring
ci:       CI/CD changes
```

## System Design

See [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) for full architecture decisions, scaling considerations, and failure handling.
