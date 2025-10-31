# Testing Guide for PR-101

This guide explains how to test the Core Backend API and Shared SDK implementation.

## Prerequisites

Before testing, ensure you have:

1. **PostgreSQL 12+** installed and running
2. **Deno 1.x** installed (`curl -fsSL https://deno.land/install.sh | sh`)
3. **Node.js 18+** and **pnpm 8+** installed

## Step 1: Database Setup

### Create the Database

```bash
# Create a new PostgreSQL database
createdb causable
```

### Apply the Schema

Connect to your database and run the schema from `Reference-LogLine-OS.md`. Here's the minimal schema needed:

```sql
-- Create schema
CREATE SCHEMA IF NOT EXISTS ledger;

-- Create the universal_registry table
CREATE TABLE IF NOT EXISTS ledger.universal_registry (
  id            uuid        NOT NULL,
  seq           integer     NOT NULL,
  entity_type   text        NOT NULL,
  who           text        NOT NULL,
  did           text,
  "this"        text        NOT NULL,
  at            timestamptz NOT NULL DEFAULT now(),
  
  -- Relationships
  parent_id     uuid,
  related_to    uuid[],
  
  -- Access control
  owner_id      text,
  tenant_id     text,
  visibility    text        NOT NULL DEFAULT 'private',
  
  -- Lifecycle
  status        text,
  is_deleted    boolean     NOT NULL DEFAULT false,
  
  -- Code & Execution
  name          text,
  description   text,
  code          text,
  language      text,
  runtime       text,
  input         jsonb,
  output        jsonb,
  error         jsonb,
  
  -- Metrics
  duration_ms   integer,
  trace_id      text,
  
  -- Cryptographic proofs
  prev_hash     text,
  curr_hash     text,
  signature     text,
  public_key    text,
  
  -- Extensibility
  metadata      jsonb,
  
  PRIMARY KEY (id)
);

-- Create the notification trigger
CREATE OR REPLACE FUNCTION ledger.notify_timeline() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('timeline_updates', row_to_json(NEW)::text);
  RETURN NEW;
END; $$;

CREATE TRIGGER ur_notify_insert AFTER INSERT ON ledger.universal_registry
FOR EACH ROW EXECUTE FUNCTION ledger.notify_timeline();

-- Create indexes
CREATE INDEX IF NOT EXISTS ur_idx_at ON ledger.universal_registry (at DESC);
CREATE INDEX IF NOT EXISTS ur_idx_entity ON ledger.universal_registry (entity_type, at DESC);
CREATE INDEX IF NOT EXISTS ur_idx_trace ON ledger.universal_registry (trace_id);
```

You can also apply the full schema from `Reference-LogLine-OS.md` which includes RLS policies and additional features.

## Step 2: Configure Environment

Set your database connection string:

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/causable"
```

Or copy the example env file:

```bash
cd packages/causable-cloud
cp .env.example .env
# Edit .env with your database credentials
```

## Step 3: Start the Backend Server

In one terminal:

```bash
cd packages/causable-cloud
deno run --allow-net --allow-env --allow-read api/index.ts
```

You should see:
```
🚀 Causable Cloud API starting on http://localhost:8000
```

## Step 4: Run the Verification Script

In a second terminal:

```bash
cd packages/causable-cloud
deno run --allow-net --allow-env scripts/verify_stream.ts
```

You should see:
```
🔍 Causable Stream Verification Tool
=====================================
Connecting to: http://localhost:8000/api/timeline/stream
Waiting for events... (Press Ctrl+C to exit)

✅ Connected to stream!

📡 Timeline stream connected
```

## Step 5: Test Real-time Updates

### Method 1: Manual Database Insert

In a third terminal, connect to your database and insert a test span:

```bash
psql causable
```

```sql
INSERT INTO ledger.universal_registry (id, seq, entity_type, who, "this", at)
VALUES (gen_random_uuid(), 0, 'test', 'developer', 'verify_test', now());
```

**Expected Result:** The verification script should immediately log the new span!

```
[2025-10-31T00:30:45.123Z] New Span Received:
──────────────────────────────────────────────
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "seq": 0,
  "entity_type": "test",
  "who": "developer",
  "this": "verify_test",
  "at": "2025-10-31T00:30:45.123Z",
  ...
}
──────────────────────────────────────────────
  Summary:  developer ? verify_test [test]
```

### Method 2: API POST Request

You can also create spans via the REST API:

```bash
curl -X POST http://localhost:8000/api/spans \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "function",
    "who": "developer",
    "did": "created",
    "this": "test_function",
    "status": "active",
    "name": "My Test Function"
  }'
```

**Expected Result:** 
1. The API returns the created span as JSON
2. The verification script immediately logs the span

## Step 6: Test the REST API

### List All Spans

```bash
curl http://localhost:8000/api/spans
```

### Filter by Entity Type

```bash
curl "http://localhost:8000/api/spans?entity_type=function&limit=10"
```

### Filter by Status

```bash
curl "http://localhost:8000/api/spans?status=active"
```

### Filter by Trace ID

```bash
curl "http://localhost:8000/api/spans?trace_id=my-trace-123"
```

## Definition of Done Checklist

This task is complete when:

- [x] The `Span` interface in the SDK is finalized and correct
- [ ] The `causable-cloud` server can be started without errors
- [ ] The verification script can connect to the SSE endpoint
- [ ] When you manually `INSERT` a new row into the database, the full span JSON object is immediately logged to the console by the verification script

## Troubleshooting

### "DATABASE_URL environment variable is required"

Make sure you've exported the DATABASE_URL:
```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/causable"
```

### "relation 'ledger.universal_registry' does not exist"

Run the schema creation SQL from Step 1.

### "Connection refused"

Make sure PostgreSQL is running:
```bash
pg_isready
```

### Verification script shows no events

1. Check that the backend server is running
2. Check that the trigger was created correctly:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'ur_notify_insert';
```

## Success Criteria

The implementation is successful when:

1. ✅ Backend starts without errors (requires valid DATABASE_URL)
2. ✅ SSE stream establishes connection
3. ✅ Manual INSERT triggers immediate notification in verification script
4. ✅ API POST creates span and triggers notification
5. ✅ GET /api/spans returns spans from database
6. ✅ Filtering works correctly

## Next Steps

After confirming the backend works:
- Proceed to PR-102: Scaffold VS Code Extension
- The SDK is already ready to use in the extension
- The backend API is ready to accept connections
