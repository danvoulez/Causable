# Causable Cloud

Backend API for the Causable ledger system.

## Development

This service uses Deno for the runtime.

### Running locally

```bash
deno run --allow-net --allow-env --allow-read api/index.ts
```

Or with npm scripts:

```bash
pnpm dev
```

## API Endpoints

- `GET /api/spans` - List spans with optional filters
- `POST /api/spans` - Create a new span
- `GET /api/timeline/stream` - SSE stream of real-time updates

## Note

This is currently a mock implementation for MVP development. In production, this would:
- Connect to PostgreSQL with the universal_registry schema
- Use LISTEN/NOTIFY for real-time events
- Implement proper authentication and RLS
