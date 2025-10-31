# Causable Cloud

Backend API for the Causable ledger system with real-time PostgreSQL integration.

## Overview

This service provides:
- REST API for querying and creating spans
- Server-Sent Events (SSE) stream for real-time updates
- PostgreSQL LISTEN/NOTIFY integration for instant notifications

## Prerequisites

- Deno 1.x
- PostgreSQL 12+ with the `ledger.universal_registry` table schema
- Environment variable `DATABASE_URL` pointing to your PostgreSQL instance

## Database Setup

The service expects a PostgreSQL database with the following:

1. Schema `ledger` with table `universal_registry`
2. Trigger function `ledger.notify_timeline()` that calls `pg_notify('timeline_updates', ...)`
3. Trigger `ur_notify_insert` on INSERT to `ledger.universal_registry`

See `../../Reference-LogLine-OS.md` for the complete schema definition.

### Quick Database Setup

```sql
-- Create schema
CREATE SCHEMA IF NOT EXISTS ledger;

-- Create table (see Reference-LogLine-OS.md for full schema)
CREATE TABLE ledger.universal_registry (
  id uuid NOT NULL,
  seq integer NOT NULL,
  entity_type text NOT NULL,
  who text NOT NULL,
  did text,
  "this" text NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  -- ... (see full schema in Reference-LogLine-OS.md)
);

-- Create notification trigger
CREATE OR REPLACE FUNCTION ledger.notify_timeline() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('timeline_updates', row_to_json(NEW)::text);
  RETURN NEW;
END; $$;

CREATE TRIGGER ur_notify_insert AFTER INSERT ON ledger.universal_registry
FOR EACH ROW EXECUTE FUNCTION ledger.notify_timeline();
```

## Configuration

Set the `DATABASE_URL` environment variable:

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/causable"
```

## Running

### Development Mode (with auto-reload)

```bash
pnpm dev
```

### Production Mode

```bash
pnpm start
```

### Verification Script

Test the SSE stream:

```bash
pnpm verify
```

This will connect to the stream and log all incoming events. To test, manually insert a row in another terminal:

```sql
INSERT INTO ledger.universal_registry (id, seq, entity_type, who, "this", at)
VALUES (gen_random_uuid(), 0, 'test', 'developer', 'verify_test', now());
```

You should see the span immediately logged by the verification script!

## API Endpoints

### GET /api/spans

List spans with optional filters.

**Query Parameters:**
- `entity_type` - Filter by entity type
- `status` - Filter by status
- `trace_id` - Filter by trace ID
- `limit` - Maximum number of results (default: 50)

**Example:**
```bash
curl "http://localhost:8000/api/spans?entity_type=function&limit=10"
```

### POST /api/spans

Create a new span. The span will be inserted into the database and automatically trigger a notification to all SSE stream listeners.

**Example:**
```bash
curl -X POST http://localhost:8000/api/spans \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "function",
    "who": "developer",
    "did": "created",
    "this": "test_function",
    "status": "active"
  }'
```

### GET /api/timeline/stream

Server-Sent Events stream for real-time updates. Connects to PostgreSQL using LISTEN and streams all notifications from the `timeline_updates` channel.

**Example:**
```bash
curl -N http://localhost:8000/api/timeline/stream
```

Or use the verification script:
```bash
deno run --allow-net --allow-env scripts/verify_stream.ts
```

## Architecture

- **Database Connection**: Uses `lib/db.ts` for PostgreSQL connection management
- **Stream Handler**: `api/routes/stream.ts` establishes LISTEN connection per SSE client
- **Spans Handler**: `api/routes/spans.ts` queries and inserts spans
- **Router**: `api/router.ts` routes requests to appropriate handlers
- **Entry Point**: `api/index.ts` starts the Deno HTTP server

## Development Notes

- Each SSE connection creates a dedicated PostgreSQL client with LISTEN
- The trigger automatically sends notifications when rows are inserted
- CORS is enabled for all origins (configure for production)
- Connection keep-alive pings are sent every 30 seconds
