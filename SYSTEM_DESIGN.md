# System Design — Project Management API

## Overview

A production-grade real-time project management REST API built with Node.js and TypeScript. The system supports workspace-based multi-tenancy, real-time collaboration via WebSockets, background job processing, and activity logging.

---

## Architecture

```
Client (Postman / Frontend)
         ↓
    Express.js API
         ↓
    ┌────┴────────────────────┐
    │                         │
PostgreSQL               MongoDB
(relational data)        (activity logs)
    │
  Prisma
    │
  Redis
    ├── Caching
    ├── BullMQ job queues
    └── Socket.io pub/sub
```

### Request Lifecycle

```
Incoming Request
      ↓
Helmet (security headers)
      ↓
CORS (origin check)
      ↓
Rate Limiter (IP or user based)
      ↓
express.json() (parse body)
      ↓
Auth Middleware (verify JWT)
      ↓
RBAC Middleware (check permissions)
      ↓
Controller (parse request)
      ↓
Service (business logic)
      ↓
Prisma (PostgreSQL query)
      ↓
Response sent to client
      ↓
BullMQ (async: email + activity log)
```

---

## Technology Decisions

### Express.js

Chosen over NestJS for simplicity and control. Express gives full visibility into every layer of the application — middleware, routing, error handling — with no magic. At this scale a structured monolith with clean separation of concerns (controllers, services, middleware) is more appropriate than an enterprise framework.

### PostgreSQL + Prisma

PostgreSQL handles all relational data — users, workspaces, projects, tasks, comments. Prisma provides a type-safe client with full TypeScript autocomplete, eliminating entire classes of runtime errors from raw SQL. Migrations give us a versioned history of every schema change.

Why PostgreSQL over MySQL:

- Superior JSON support (JSONB)
- Better full-text search
- More advanced indexing options
- Stronger ACID compliance

### MongoDB + Mongoose

Used exclusively for activity logs. Activity data is document-shaped — each action type has different metadata fields. MongoDB's flexible schema handles this naturally without requiring schema migrations every time a new action type is added. High write volume with no join requirements makes it a perfect fit.

Why not store logs in PostgreSQL:

- Activity logs have variable structure per action type
- High write volume would increase load on the primary database
- No relational queries needed on logs
- Separation of concerns — transactional data vs audit data

### Redis

Serves three purposes:

**Caching** — frequently accessed data like workspace members is cached in Redis to avoid repeated PostgreSQL queries on every request.

**BullMQ** — all background jobs (emails, activity logging) are queued in Redis via BullMQ. This decouples slow operations from the request lifecycle — the API responds immediately while jobs process asynchronously.

**Socket.io pub/sub** — when the API runs on multiple instances, Redis pub/sub ensures WebSocket events broadcast to all connected clients regardless of which server instance they're connected to.

### BullMQ

Chosen over simple async functions because it provides:

- Persistent job storage (jobs survive server restarts)
- Automatic retries with exponential backoff
- Dead letter queue for permanently failed jobs
- Job prioritization and delayed execution
- Visibility into job status and history

### Socket.io

Handles real-time bidirectional communication. Clients join workspace rooms on connect. When a task is created or updated, the server emits an event to all members of that workspace simultaneously. JWT authentication is verified on the WebSocket handshake — unauthenticated connections are rejected before joining any room.

### JWT with Refresh Token Rotation

Access tokens expire in 15 minutes — short enough to limit damage if stolen. Refresh tokens are long-lived (7 days) but stored as SHA-256 hashes in PostgreSQL — if the database is compromised, raw tokens cannot be recovered. Token rotation means every refresh invalidates the old token and issues a new one — a stolen refresh token is detected when the legitimate user's next refresh fails.

---

## Database Schema Design

### Key Decisions

**Soft Deletes** — tasks, projects, workspaces and comments use `deletedAt` instead of hard deletes. This preserves audit history, allows data recovery, and satisfies compliance requirements where data cannot be immediately purged.

**Indexes** — every foreign key used in WHERE clauses or JOINs has an index:

```
tasks(projectId)                       → list tasks by project
tasks(assignedToId)                    → list tasks assigned to user
workspace_members(workspaceId, userId) → membership checks
comments(taskId)                       → list comments by task
```

**Composite unique constraint** — `workspace_members(workspaceId, userId)` prevents a user from being added to the same workspace twice at the database level — not just application level.

**IdempotencyKey table** — stores request keys with results and expiry. Prevents duplicate task creation when clients retry failed requests. Keys expire after 24 hours and are cleaned up periodically.

---

## RBAC Design

Three roles per workspace:

```
owner  → full control including deleting workspace
admin  → can invite/remove members, edit any task
member → can create tasks, edit own tasks only
```

Permission checks happen in middleware before reaching the controller:

```typescript
canUserPerformAction(userId, workspaceId, "edit_any_task");
```

This queries the `workspace_members` table and checks the role. The result is cached in Redis for the duration of the request to avoid repeated DB calls in deeply nested middleware chains.

---

## Cursor-Based Pagination

Tasks use cursor-based pagination instead of offset pagination.

**Why not offset pagination:**

```sql
SELECT * FROM tasks LIMIT 10 OFFSET 1000
```

PostgreSQL must scan and discard 1000 rows before returning results. Slow on large tables.

**Cursor pagination:**

```sql
SELECT * FROM tasks WHERE id < lastSeenId LIMIT 10
```

Uses the index directly — instant regardless of dataset size. The cursor is a base64-encoded record ID passed between requests.

---

## Idempotency

Task creation accepts an `Idempotency-Key` header. The flow:

```
Client sends request with Idempotency-Key: uuid
      ↓
Middleware checks IdempotencyKey table
      ↓
Key exists?  → return cached result (no duplicate)
Key missing? → process request → store result with key
      ↓
Keys expire after 24 hours
```

This allows clients to safely retry failed requests without creating duplicates — critical for unreliable network conditions.

---

## Failure Handling

### Redis goes down

- Caching is bypassed — requests fall back to PostgreSQL directly
- BullMQ jobs pause and resume automatically when Redis recovers
- Socket.io falls back to single-instance mode (no cross-server broadcasting)
- App logs a warning but does not crash

### PostgreSQL goes down

- App crashes with a clear error on startup if DB is unreachable
- During runtime — requests fail with 500, logged with full context
- Prisma retries the connection automatically

### MongoDB goes down

- Activity logging is paused — BullMQ jobs retry until MongoDB recovers
- Core API functionality (tasks, workspaces) continues unaffected
- Separation of concerns means primary database failure does not affect audit logging and vice versa

### BullMQ job fails

- Retried 3 times with exponential backoff (1s, 2s, 4s)
- After 3 failures → moved to dead letter queue
- Dead letter queue is monitored and logged with full error context
- Failed email jobs do not affect the API response — fire and forget

### Socket.io client disconnects

- Client automatically attempts reconnection
- On reconnect client rejoins workspace room
- Missed events are not replayed — UI refreshes data on reconnect

---

## Scaling Considerations

### Horizontal scaling

The API is stateless — no in-memory session state. Multiple instances can run behind a load balancer. Redis handles shared state (cache, queues, Socket.io pub/sub).

### Database scaling

- Read replicas for PostgreSQL to distribute read load
- MongoDB sharding for activity logs as volume grows
- Redis cluster for high availability

### Rate limiting

- Global: 100 requests per 15 minutes per IP
- Auth routes: 10 requests per 15 minutes per IP
- Invite endpoint: 10 requests per hour per IP
- Per-user rate limiting via Redis for authenticated endpoints

---

## Security Decisions

| Decision              | Reason                                        |
| --------------------- | --------------------------------------------- |
| Helmet                | Sets 14 secure HTTP headers automatically     |
| CORS with allowlist   | Rejects requests from unknown origins         |
| JWT expiry 15 min     | Limits damage window if token is stolen       |
| Hashed refresh tokens | Database breach cannot expose active sessions |
| Zod env validation    | App crashes at startup if config is invalid   |
| Input sanitization    | Prevents XSS and NoSQL injection              |
| Rate limiting         | Prevents brute force and abuse                |
| RBAC middleware       | Authorization checked before business logic   |

---

## API Versioning

All endpoints are prefixed with `/api/v1/`. Breaking changes introduce `/api/v2/` routes alongside existing ones — old clients continue working without modification.
