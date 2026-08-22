# DayOS

DayOS is a personal adaptive day-planning system. It answers a practical question: given the work, learning, health, meals, recovery, and personal commitments that matter today, what should happen now—and how should the rest of the day change when reality does?

The MVP is a production-structured pnpm/Turborepo monorepo with a Next.js 16.3.1 web client, standalone Express API, deterministic planner, shared contracts, and Neon PostgreSQL schema managed by Drizzle.

## Product surfaces

- Premium responsive landing page, Clerk-ready sign-in and sign-up, and an eight-step onboarding flow
- Today control center with Right Now, Next, animated timeline, live current-time marker, balance, hydration, free time, and adaptive rebalance feedback
- Focus mode with timestamp-derived timer and completion/rating flow
- Task CRUD and optimistic completion, habit rhythm/completion, day/week calendar editing surface, deterministic insights, and user preferences
- System, light, and dark themes; reduced-motion support; keyboard focus states; mobile glass navigation
- Credential-free local demo mode and user-scoped Clerk + Neon production mode

## Architecture

```text
Next.js web ── typed @dayos/api-client ──> Express /api/v1
                                                │
                                         services/routes
                                                │
                         @dayos/contracts + @dayos/planner
                                                │
                                  Drizzle ──> Neon PostgreSQL
```

The web and a future Expo client are API clients. Browser code never connects to PostgreSQL. Shared packages contain portable types, validation, time utilities, design tokens, and planner rules—never Next.js, Express, or React Native runtime dependencies.

## Monorepo

```text
apps/
  web/              Next.js 16.3.1 App Router
  api/              Express 5 API and Docker image
packages/
  api-client/       Fetch-based typed client with injectable auth tokens
  config/           Cross-app constants
  contracts/        Shared Zod request schemas and DTOs
  database/         Drizzle schema, migration, and Neon connection
  design-tokens/    Platform-neutral visual and motion values
  domain/           Pure DayOS domain types
  planner/          Pure deterministic plan generation and rebalance rules
  utils/            Timezone-safe time helpers
docs/
  architecture.md
  planner.md
```

## Local development

Requirements: Node.js 20.9 or newer and pnpm 10.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Web: `http://localhost:3000`  
API: `http://localhost:4000`  
Health: `http://localhost:4000/health`

Without credentials, the API defaults to isolated in-process demo data. This makes every core flow runnable immediately. Set `AUTH_MODE=clerk` and add Clerk/Neon credentials to use durable production persistence. Demo mode is rejected in production.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon pooled PostgreSQL connection string |
| `CLERK_SECRET_KEY` | Server-side Clerk token verification |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk web client |
| `NEXT_PUBLIC_API_URL` | Browser-visible API base, normally `http://localhost:4000/api/v1` |
| `API_PORT` | Express port, default `4000` |
| `WEB_URL` | Exact allowed CORS origin |
| `AUTH_MODE` | `demo` locally or `clerk` for production |
| `LOG_LEVEL` | Pino log level |

## Database

The canonical schema is [packages/database/src/schema.ts](packages/database/src/schema.ts). It contains 15 user-scoped tables and explicit PostgreSQL enums for profiles, life areas, tasks, habits/completions, plans, time blocks, focus sessions, hydration, meals, exercise, learning, reflections, and planner audit events.

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm db:verify
```

Recurring local preferences use PostgreSQL `time` values plus the user's IANA timezone. Scheduled events and sessions use UTC `timestamptz` values.
`db:verify` performs a temporary end-to-end write/read/update/relationship/cascade check against the configured Neon database and removes all verification data before exiting.

## Authentication

Clerk tokens are sent as `Authorization: Bearer <token>`. The Express middleware verifies the token and derives the identity from its subject; no endpoint accepts a client-supplied user ID. CORS is allowlisted, errors are normalized, mutation traffic is rate-limited, and logs redact credentials/tokens.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

Vitest covers planner constraints/rebalancing and Supertest covers user isolation, validation, task flow, hydration, focus, and schedule conflicts. Playwright covers onboarding, tasks, focus, rebalance, hydration, and mobile overflow.

## Deployment

- Web: deploy `apps/web` to Vercel and point `NEXT_PUBLIC_API_URL` at the API
- API: build [apps/api/Dockerfile](apps/api/Dockerfile) on Railway, Render, Fly.io, or another OCI platform
- Database: create a Neon project, set `DATABASE_URL`, and run migrations
- Configure matching production `WEB_URL` and Clerk allowed origins

The API handles `SIGTERM`/`SIGINT` for container-safe shutdown.

## Known MVP limits

- Calendar dragging is implemented as an interaction surface; richer resize handles and multi-day editing are the next refinement.
- In-app reminders are represented by a portable service contract, but external push delivery is intentionally out of scope.
- Insights are deterministic and useful with seed data; best-focus-window confidence should become stricter as history grows.
- Local demo mode is in-memory by design. Neon mode is the durable path.
- No Apple integrations, notifications, native haptics, AI, agents, embeddings, or recommendation models are included.

## Next phase

The shared contracts, domain, planner, API client, and tokens are ready to support an Expo/React Native iOS client. Logical next additions are APNs, Live Activities, widgets, HealthKit and calendar integrations. An AI reasoning layer can be considered later as a separate, auditable enhancement; deterministic scheduling remains the authority in this MVP.
# day-os
