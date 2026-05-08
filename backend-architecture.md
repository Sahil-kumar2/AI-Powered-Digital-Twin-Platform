# Backend Architecture: AI Digital Twin Platform

## Section 1 — Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENTS (Browser)                      │
│               Next.js Frontend via REST + WS                │
└────────────┬────────────────────────────┬───────────────────┘
             │ REST / HTTP                │ WebSocket (Socket.io)
             ▼                            ▼
┌────────────────────┐         ┌──────────────────────┐
│   Core API Service │◄───────►│  WebSocket Service   │
│   (Express / TS)   │         │  (Socket.io Server)  │
└──┬─────┬─────┬─────┘         └──────────▲───────────┘
   │     │     │                          │
   │     │     │   ┌──────────────────────┤
   │     │     │   │  Redis Pub/Sub       │
   │     │     ▼   ▼                      │
   │     │  ┌──────────────┐   ┌──────────┴──────────┐
   │     │  │  Redis Layer │   │ Telemetry Processor  │
   │     │  │  Cache/Queue │   │      Service         │
   │     │  └──────┬───────┘   └──────────▲───────────┘
   │     │         │                      │
   │     │         │ Redis Streams        │
   │     │         ▼                      │
   │     │  ┌──────────────┐              │
   │     └──► Simulation   ├──────────────┘
   │        │   Engine     │  publishes telemetry events
   │        └──────────────┘
   │
   ▼
┌──────────────┐     ┌──────────────┐
│  PostgreSQL  │     │ Alerting Svc │◄── Telemetry Processor
│  (Prisma)    │     │ (Rule Engine)│
└──────────────┘     └──────────────┘
```

**Data flow**: Client → API → PostgreSQL for CRUD. Simulation Engine publishes telemetry ticks to **Redis Streams**. The Telemetry Processor consumes the stream, persists to Postgres, evaluates alert rules, and publishes to **Redis Pub/Sub**. The WebSocket Service subscribes to Pub/Sub channels and pushes data to the browser in real time.

---

## Section 2 — Service Breakdown

| Service | Responsibility | Port |
|---|---|---|
| **Core API** | Auth, CRUD for systems/components/connections/alerts, REST endpoints | `3001` |
| **Simulation Engine** | Generates telemetry ticks per simulation, publishes to Redis Streams | internal |
| **Telemetry Processor** | Consumes Redis Streams, persists data, evaluates alert rules | internal |
| **Alerting Service** | Stores rules, evaluates incoming telemetry, triggers notifications | internal |
| **WebSocket Service** | Manages Socket.io rooms per system, pushes real-time data | shares `3001` |
| **System Mgmt Service** | Manages system/component CRUD logic (called by Core API routes) | internal |

> For the initial monolith, all services run in-process. They are separated as **modules** that can be extracted into standalone microservices later.

---

## Section 3 — Database Schema (PostgreSQL / Prisma)

```prisma
model User {
  id             String          @id @default(uuid())
  email          String          @unique
  password       String
  name           String?
  role           String          @default("engineer") // engineer | admin
  organizationId String?
  organization   Organization?   @relation(fields: [organizationId], references: [id])
  systems        ElectronicSystem[]
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
}

model Organization {
  id        String   @id @default(uuid())
  name      String
  users     User[]
  createdAt DateTime @default(now())
}

model ElectronicSystem {
  id               String             @id @default(uuid())
  name             String
  description      String?
  userId           String
  user             User               @relation(fields: [userId], references: [id])
  components       Component[]
  connections      Connection[]
  simulationConfigs SimulationConfig[]
  alertRules       AlertRule[]
  alerts           Alert[]
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt
}

model Component {
  id          String           @id @default(uuid())
  systemId    String
  system      ElectronicSystem @relation(fields: [systemId], references: [id], onDelete: Cascade)
  type        String           // Sensor | Microcontroller | Actuator | PowerSupply | CommModule
  name        String
  x           Float
  y           Float
  parameters  String           // JSON-stringified config
  sourceConns Connection[]     @relation("SourceComponent")
  targetConns Connection[]     @relation("TargetComponent")
}

model Connection {
  id        String           @id @default(uuid())
  systemId  String
  system    ElectronicSystem @relation(fields: [systemId], references: [id], onDelete: Cascade)
  sourceId  String
  source    Component        @relation("SourceComponent", fields: [sourceId], references: [id])
  targetId  String
  target    Component        @relation("TargetComponent", fields: [targetId], references: [id])
  sourcePin String?
  targetPin String?
}

model SimulationConfig {
  id        String           @id @default(uuid())
  systemId  String
  system    ElectronicSystem @relation(fields: [systemId], references: [id], onDelete: Cascade)
  speed     Float            @default(1.0)  // 1x, 2x, 5x
  tickMs    Int              @default(1000)
  failures  String?          // JSON: [{componentId, failureType}]
  status    String           @default("idle") // idle | running | stopped
  createdAt DateTime         @default(now())
}

model TelemetryData {
  id          String   @id @default(uuid())
  systemId    String
  componentId String
  metric      String   // temperature | voltage | current | latency
  value       Float
  timestamp   DateTime @default(now())

  @@index([systemId, timestamp])
  @@index([componentId, timestamp])
  @@index([systemId, componentId, metric, timestamp])
}

model AlertRule {
  id        String           @id @default(uuid())
  systemId  String
  system    ElectronicSystem @relation(fields: [systemId], references: [id], onDelete: Cascade)
  metric    String
  operator  String           // gt | lt | eq | gte | lte
  threshold Float
  severity  String           @default("warning") // low | warning | high | critical
  enabled   Boolean          @default(true)
  createdAt DateTime         @default(now())
}

model Alert {
  id          String           @id @default(uuid())
  systemId    String
  system      ElectronicSystem @relation(fields: [systemId], references: [id], onDelete: Cascade)
  ruleId      String?
  componentId String?
  severity    String
  message     String
  status      String           @default("active") // active | acknowledged | resolved
  createdAt   DateTime         @default(now())
  resolvedAt  DateTime?
}
```

**Indexing strategy**: The `TelemetryData` table is the highest-write table. Compound indices on `(systemId, timestamp)` and `(componentId, timestamp)` enable fast time-range queries. For production scale, migrate to **TimescaleDB** hypertables for automatic partitioning.

---

## Section 4 — Telemetry Data Pipeline

```
Simulation Engine (per system)
  │  generates telemetry tick every N ms
  ▼
Redis Stream: "telemetry:{systemId}"
  │  message: { componentId, metric, value, timestamp }
  ▼
Telemetry Processor (consumer group)
  ├── 1. Batch INSERT into PostgreSQL (bulk every 500ms)
  ├── 2. Evaluate AlertRules → create Alert rows if triggered
  └── 3. Publish to Redis Pub/Sub channel "live:{systemId}"
          │
          ▼
       WebSocket Service
          │  broadcasts to Socket.io room "system:{systemId}"
          ▼
       Frontend Dashboard (Recharts)
```

**Batching strategy**: The Telemetry Processor accumulates incoming messages in a buffer and flushes to PostgreSQL every **500ms** or when the buffer reaches **100 records**, whichever comes first. This prevents per-tick INSERT overhead.

**Backpressure**: If the consumer falls behind, Redis Streams' pending entry list (PEL) retains unacknowledged messages. The consumer can resume from the last acknowledged ID after restart.

---

## Section 5 — Event Queue Architecture (Redis Streams)

**Why Redis Streams over Kafka**: For a platform starting with simulated data at 1–10 ticks/second across a few dozen systems, Redis Streams provides sufficient throughput with zero operational overhead. Kafka is viable at 100k+ events/sec scale.

**Message format** (JSON):
```json
{
  "systemId": "uuid",
  "componentId": "uuid",
  "metric": "temperature",
  "value": 34.7,
  "timestamp": "2026-03-09T18:00:00.000Z"
}
```

**Consumer group**: `telemetry-processors`. Multiple consumer instances read from the same group for horizontal scaling. Each message is delivered to exactly one consumer.

**Event replay**: Redis Streams retain messages for a configurable time window (e.g., 24 hours via `MAXLEN` or `MINID`). Historical replay is possible by reading from a specific stream ID.

---

## Section 6 — Simulation Engine Service

Each active simulation spawns a **SimulationWorker** — an in-process `setInterval` loop (or, for scale, a dedicated worker thread via `worker_threads`).

**Signal models per component type**:
| Type | Signal | Model |
|---|---|---|
| Sensor (Temp) | temperature | `baseTemp + sin(t * freq) * amplitude + noise()` |
| Sensor (Pressure) | pressure | `basePressure + brownianMotion(t)` |
| PowerSupply | voltage | `nominalV + ripple(t) + noise()` |
| Actuator (Motor) | current | `loadCurrent * dutyCycle + inrushSpike(t)` |
| CommModule | latency | `baseLatency + jitter()` |

**Failure injection**: When a failure scenario is triggered (e.g., "Overheating"), the worker modifies the signal model to produce degrading curves — a slow exponential rise in temperature, for example.

**Scaling**: Each worker is lightweight (~0.1MB memory). A single Node.js process can comfortably run 50–100 concurrent simulations. Beyond that, spawn dedicated worker threads or offload to separate processes.

---

## Section 7 — WebSocket Streaming Service

**Technology**: Socket.io, sharing the same HTTP server as the Core API.

**Subscription model**:
1. Client connects and emits `join_system(systemId)`.
2. Server joins the socket to room `system:{systemId}`.
3. The Telemetry Processor publishes processed data to Redis Pub/Sub channel `live:{systemId}`.
4. The WebSocket service subscribes to all active `live:*` channels and broadcasts to matching rooms.

**Scaling**: When running multiple API instances behind a load balancer, use the `socket.io-redis` adapter. All instances share state through Redis Pub/Sub, ensuring messages reach all connected clients regardless of which instance they're connected to.

---

## Section 8 — Alerting System

**Rule storage**: `AlertRule` rows in PostgreSQL, scoped per system.

**Evaluation flow**:
1. Telemetry Processor receives a data point `{metric: "temperature", value: 72.3}`.
2. Loads cached rules for that system (refreshed every 30s from DB).
3. Evaluates: `if (value > rule.threshold && rule.operator === 'gt')`.
4. If triggered, creates an `Alert` row and publishes an `alert:{systemId}` event via Redis Pub/Sub.
5. WebSocket service pushes the alert to the frontend notification bell.

**Operator mapping**: `gt` → `>`, `lt` → `<`, `gte` → `>=`, `lte` → `<=`, `eq` → `===`.

**Deduplication**: Once an alert fires, it enters a cooldown window (configurable, default 60s) during which the same rule won't re-fire for the same component.

---

## Section 9 — API Design

### Authentication
| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/api/auth/signup` | `{email, password, name}` | `{message}` |
| `POST` | `/api/auth/login` | `{email, password}` | `{token, user}` |

### Systems
| Method | Path | Body / Params | Response |
|---|---|---|---|
| `POST` | `/api/systems` | `{name, description}` | `System` |
| `GET` | `/api/systems` | — | `System[]` |
| `GET` | `/api/systems/:id` | — | `System + components + connections` |
| `PUT` | `/api/systems/:id` | `{name?, description?}` | `System` |
| `DELETE` | `/api/systems/:id` | — | `{message}` |

### Components
| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/api/components` | `{systemId, type, name, x, y, parameters}` | `Component` |
| `PUT` | `/api/components/:id` | `{name?, x?, y?, parameters?}` | `Component` |
| `DELETE` | `/api/components/:id` | — | `{message}` |

### Simulation
| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/api/simulation/start/:systemId` | `{speed?, tickMs?, failures?}` | `{message, configId}` |
| `POST` | `/api/simulation/stop/:systemId` | — | `{message}` |
| `GET` | `/api/simulation/status/:systemId` | — | `{status, uptime}` |

### Telemetry
| Method | Path | Query | Response |
|---|---|---|---|
| `GET` | `/api/telemetry/:systemId` | `?from=&to=&component=&metric=` | `TelemetryData[]` |

### Alerts
| Method | Path | Body | Response |
|---|---|---|---|
| `GET` | `/api/alerts/:systemId` | `?status=&severity=` | `Alert[]` |
| `POST` | `/api/alerts/:id/acknowledge` | — | `Alert` |
| `POST` | `/api/alerts/:id/resolve` | — | `Alert` |
| `POST` | `/api/alert-rules` | `{systemId, metric, operator, threshold, severity}` | `AlertRule` |
| `GET` | `/api/alert-rules/:systemId` | — | `AlertRule[]` |

---

## Section 10 — Authentication & Authorization

- **JWT** tokens signed with `HS256`, 24-hour expiry.
- Middleware extracts `user.id` from the token and attaches to `req.user`.
- **Roles**: `engineer` (default), `admin` (full access).
- **System-level permissions**: All system queries filter by `userId` to enforce ownership. Admins bypass this filter when `organizationId` matches.

---

## Section 11 — Caching Layer (Redis)

| Use Case | Key Pattern | TTL |
|---|---|---|
| Latest telemetry snapshot | `snapshot:{systemId}` | 10s |
| Alert rules cache | `rules:{systemId}` | 30s |
| Active simulation status | `sim:{systemId}` | none (deleted on stop) |
| Session / rate limiting | `ratelimit:{ip}` | 60s |
| Pub/Sub channels | `live:{systemId}`, `alert:{systemId}` | N/A |

---

## Section 12 — Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | Express.js (TypeScript) |
| ORM | Prisma 5 |
| Database | PostgreSQL 15 (SQLite for local dev) |
| Queue/Cache | Redis 7 (Redis Streams + Pub/Sub) |
| Realtime | Socket.io 4 |
| Auth | jsonwebtoken + bcryptjs |
| Dev Tools | ts-node, nodemon, Docker Compose |

---

## Section 13 — Scaling Strategy

| Component | Strategy |
|---|---|
| API Servers | Horizontal. Run N instances behind a load balancer. Stateless JWT auth. |
| Simulation Workers | Vertical first (worker threads), then horizontal (dedicated sim-worker processes). |
| Telemetry Processors | Horizontal via Redis Streams consumer groups. Add consumers as throughput grows. |
| WebSocket Servers | Horizontal with `socket.io-redis` adapter for cross-instance Pub/Sub. |
| PostgreSQL | Read replicas for telemetry queries. TimescaleDB for automatic partitioning. |
| Redis | Redis Cluster for sharding at extreme scale. |

---

## Section 14 — Deployment Architecture

```yaml
# docker-compose.prod.yml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: digital_twin
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes: [pg_data:/var/lib/postgresql/data]
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  backend:
    build: ./backend
    depends_on: [postgres, redis]
    environment:
      DATABASE_URL: postgresql://admin:${DB_PASSWORD}@postgres:5432/digital_twin
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
    ports: ["3001:3001"]

  ai-service:
    build: ./ai-service
    ports: ["8000:8000"]

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    depends_on: [backend]
```

---

## Section 15 — Monitoring & Logging

| Concern | Tool | Implementation |
|---|---|---|
| Request logging | Morgan / Pino | Structured JSON logs per request |
| Telemetry metrics | Prometheus client | Expose `/metrics` endpoint with counters for ticks/sec, queue depth |
| Dashboard | Grafana | Visualize Prometheus metrics |
| Error tracking | Sentry (optional) | Capture unhandled exceptions |
| Health checks | `/api/health` | Returns DB, Redis, and simulation engine status |

**Key metrics to track**:
- `telemetry_ticks_per_second` (gauge)
- `redis_stream_pending_messages` (gauge)
- `active_simulations_count` (gauge)
- `alert_rules_evaluated_total` (counter)
- `websocket_active_connections` (gauge)
