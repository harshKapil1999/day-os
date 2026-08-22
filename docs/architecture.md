# DayOS architecture

## Boundary map

```text
Next.js App Router                     Future Expo app
        │                                     │
        └──────── @dayos/api-client ──────────┘
                          │
                    Express /api/v1
                          │
            auth → route → service boundary
                          │
           @dayos/contracts / @dayos/planner
                          │
             repository / persistence bridge
                          │
                  Drizzle → Neon
```

### Web

`apps/web` uses Next.js 16.3.1 App Router and React Server Components for document/layout boundaries. Interactive product surfaces are intentionally narrow client components. TanStack Query provides the cache boundary, while the shared API client injects a Clerk token without importing Next.js internals.

### API

`apps/api` is the only application runtime that imports the database package. Middleware assigns request IDs, verifies Clerk tokens, applies allowlisted CORS and rate limits, and converts errors to stable JSON. Routes validate inputs with shared Zod contracts and call portable planner/domain functions. Production requests hydrate and persist owner-scoped data through Drizzle before mutation responses complete.

### Shared packages

- `domain`: pure entities/enums and notification/haptic semantics
- `contracts`: the single source for request validation and DTO shapes
- `planner`: pure deterministic scheduling and replanning
- `api-client`: fetch client with configurable token injection, suitable for web or Expo
- `database`: PostgreSQL schema, migration, and connection factory; server-only
- `design-tokens`: numeric/semantic values rather than DOM components
- `utils`: timezone-aware conversion of local recurring times to absolute instants

### Data ownership and security

The Clerk token subject is the only source of user identity. Browser-supplied user IDs are ignored. Every repository query scopes by the resolved internal user ID. Drizzle parameterizes SQL. Production refuses demo authentication or missing Clerk/Neon configuration. Auth tokens and database credentials are redacted from structured logs.

### Time model

- IANA timezone is stored on the profile.
- Recurring preferences such as `07:00` are stored as local `time`, not fake UTC timestamps.
- Calendar blocks, deadlines, focus sessions, and hydration logs are stored as UTC `timestamptz`.
- Plan generation combines a local date/time with the profile timezone using `@date-fns/tz`.
- Cross-midnight sleep and DST-capable zones are handled at the conversion boundary rather than scattered across UI code.

### Mobile path

An Expo app can import contracts, domain, planner, API client, utilities, and design tokens without importing web components. Native haptics, HealthKit, APNs, Live Activities, widgets, App Intents, and Watch support remain separate adapters around the shared core.
