# Causable - Verifiable Runtime for Autonomous AI

The Causable VS Code Extension provides a real-time, "god-view" of the universal ledger, living directly inside your editor. This MVP delivers a high-quality, read-only view of the timeline.

## Project Structure

This is a monorepo containing:

- **`packages/sdk`** - Shared TypeScript types and client library
- **`packages/causable-cloud`** - Deno-based backend API with SSE streaming
- **`packages/vscode-causable`** - VS Code extension with React UI

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm 8+
- Deno 1.x (for the backend)
- PostgreSQL 12+ (for the ledger database)
- VS Code 1.80+

### Installation

```bash
# Install dependencies
pnpm install

# Build the SDK
cd packages/sdk
pnpm build
```

### Database Setup

The backend requires a PostgreSQL database with the Causable ledger schema. See `Reference-LogLine-OS.md` for the complete schema, or run the setup script:

```sql
-- Create the ledger schema and universal_registry table
-- See Reference-LogLine-OS.md for full schema
```

Set the database connection string:

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/causable"
```

### Running the Backend

```bash
# Start the backend server (requires DATABASE_URL environment variable)
cd packages/causable-cloud
deno run --allow-net --allow-env --allow-read api/index.ts

# Or use pnpm from the root
pnpm dev:cloud
```

The API will be available at `http://localhost:8000`.

### Running the Extension

1. Open VS Code in the `packages/vscode-causable` directory
2. Press `F5` to launch the Extension Development Host
3. In the new window, click the Causable icon in the Activity Bar
4. Use the command palette (`Cmd+Shift+P`) to run:
   - `Causable: Set API URL` - Set to `http://localhost:8000`
   - `Causable: Set API Key` - (Optional for MVP)

### Testing the SSE Stream

Use the verification script to test real-time updates:

```bash
cd packages/causable-cloud
pnpm verify
```

In another terminal, manually insert a span into the database:

```sql
INSERT INTO ledger.universal_registry (id, seq, entity_type, who, "this", at)
VALUES (gen_random_uuid(), 0, 'test', 'developer', 'verify_test', now());
```

The verification script should immediately log the new span!

You can also create spans via the API:

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

Watch the span appear in real-time in the VS Code extension!

## Features

### MVP (Current)

- ✅ Real-time SSE streaming of spans
- ✅ Timeline view in VS Code sidebar
- ✅ Secure API key storage
- ✅ Connection status indicator
- ✅ Basic span display

### Coming Soon

- [ ] Filtering by entity_type, status, trace_id
- [ ] Detailed JSON view for spans
- [ ] Syntax highlighting for span details
- [ ] Performance optimizations for 1000+ spans
- [ ] PostgreSQL integration with LISTEN/NOTIFY
- [ ] Full authentication and RLS

## Architecture

The system follows the Causable/LogLineOS architecture:

- **Ledger-first**: Everything is a span in the universal registry
- **Semantic columns**: ~70 columns with meaning
- **Append-only**: Immutable timeline
- **Real-time**: SSE streaming with PostgreSQL NOTIFY
- **Monorepo**: Shared types and code

## Documentation

- [Epics and PRs](./Epics-and-PRs.md) - Detailed implementation plan
- [Architecture](./Architecture.md) - Granular architecture details
- [Blue Book](./Blue%20book.md) - Philosophical foundation
- [Reference LogLine OS](./Reference-LogLine-OS.md) - Complete LogLineOS specification

## Development

### Building

```bash
# Build everything
pnpm install
cd packages/sdk && pnpm build
cd ../vscode-causable && pnpm compile
```

### Debugging

- Use F5 in VS Code to launch the extension in debug mode
- Check the Debug Console for extension logs
- Check the Developer Tools Console in the webview for UI logs

## License

MIT
