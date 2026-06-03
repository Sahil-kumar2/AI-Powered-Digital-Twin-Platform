# Digital Twin — Real-Time Digital Twin Platform

Digital Twin is a full-stack, multi-service platform for simulating, monitoring, and interacting with physical systems in real time. It includes a Next.js frontend, a Node backend with Prisma, and a Python AI helper service.

---

## 🔗 Live / Demo
 - https://ai-powered-digital-twin-platform.vercel.app/

---

## 🚀 Core Features
 - Real-time telemetry ingestion and processing
 - Simulation engine for running scenarios and replaying telemetry
 - Scenario engine to orchestrate automated actions in simulations
 - AI service for knowledge retrieval and assistant features
 - Role-based API and component architecture for modular services
 - Alerts & notifications pipeline for critical events

---

## 🧱 System Architecture
 - Frontend: Next.js (app router) + TypeScript
 - Backend: Node.js + Express + Prisma (Postgres or chosen DB)
 - AI Service: Python microservice for embeddings and retrieval
 - Real-time: WebSocket / event-driven messaging between frontend and backend
 - Persistence: Prisma-managed relational DB and optional vector store for embeddings

---

## 🧠 Key Design Decisions
 - Keep the AI logic isolated in `ai-service/` to allow language/toolchain flexibility.
 - Use a service-oriented structure in `backend/src/services` (e.g., `SimulationEngine`, `ScenarioEngine`, `TelemetryProcessor`) for testability and clear responsibilities.
 - Persist structured telemetry and use event processors to decouple ingestion from analysis.
 - Use Prisma migrations (see `backend/prisma/migrations`) to manage schema changes safely.

---

## 🛠 Tech Stack
**Frontend:** Next.js (TypeScript), React, Tailwind CSS (if present)  
**Backend:** Node.js, Express, Prisma  
**AI / ML:** Python (embedding + retrieval), local vector file `ai-service/data/local_vectors.json`  
**Infrastructure:** Docker Compose (optional), WebSockets, Redis (optional for caching/rate-limiting)

---

## Quick Start

Prerequisites:
 - Node.js 18+ and a package manager (`npm` or `pnpm`)
 - Python 3.10+
 - Docker & Docker Compose (optional)

1) Backend (development)

```bash
cd backend
npm install
npm run dev
```

2) Frontend (development)

```bash
cd frontend
npm install
npm run dev
```

3) AI Service (optional)

```powershell
cd ai-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

4) Run locally with Docker Compose (optional)

```bash
docker compose up --build
```

---

## Environment & Configuration
 - Inspect `backend/src` for environment variables used by services (DB URL, JWT keys, third-party API keys).
 - Prisma schema: [backend/prisma/schema.prisma](backend/prisma/schema.prisma)
 - Migrations: [backend/prisma/migrations](backend/prisma/migrations)

---

## Running Tests
 - Backend tests: check `backend/package.json` scripts and run `npm test` from `backend/`.
 - Frontend tests: run `npm test` from `frontend/` (see `vitest.config.ts` and `tests/`).

---

## Repository Structure (high level)
 - `frontend/` — Next.js UI and components
 - `backend/` — API, services, Prisma schema, tests
 - `ai-service/` — Python helpers, embeddings, local vector store
 - `docker-compose.yml` — optional multi-service composition

---

## Helpful Links
 - AI service README: [ai-service/README.md](ai-service/README.md)
 - Backend entrypoint: [backend/src/index.ts](backend/src/index.ts)
 - Frontend entrypoint: [frontend/src/app/page.tsx](frontend/src/app/page.tsx)
 - Key backend services: [backend/src/services/SimulationEngine.ts](backend/src/services/SimulationEngine.ts)

---

## 👤 Author
**Sahil Kumar** — B.Tech Student | Aspiring Software Development Engineer

 - GitHub: https://github.com/Sahil-kumar2
 - LinkedIn: https://www.linkedin.com/in/sahil-kumar-873910293

---