# PR-103 Testing Guide: SSE Connection and Real-time Streaming

This guide explains how to test the real-time Server-Sent Events (SSE) connection between the VS Code extension and the Causable Cloud backend.

## Prerequisites

1. **Backend Running**: Ensure the causable-cloud backend is running
   ```bash
   cd packages/causable-cloud
   deno run --allow-net --allow-env --allow-read api/index.ts
   ```

2. **Database**: The backend needs a PostgreSQL database with the `ledger.universal_registry` table and the `timeline_updates` trigger configured.

## Testing Steps

### 1. Install the Extension in VS Code

From the `packages/vscode-causable` directory:
```bash
pnpm run compile
pnpm run build:webview
```

Then press F5 in VS Code to launch the Extension Development Host.

### 2. Configure API Credentials

In the Extension Development Host, run the following commands:

1. **Set API URL**:
   - Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
   - Type `Causable: Set API URL`
   - Enter: `http://localhost:8000` (or your backend URL)

2. **Set API Key**:
   - Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
   - Type `Causable: Set API Key`
   - Enter your API key (any non-empty string for local testing)

### 3. Open the Causable Sidebar

1. Click the Causable icon in the Activity Bar (left sidebar)
2. The "Ledger Timeline" panel should open
3. You should see a connection status indicator at the top

### 4. Open the Webview Developer Tools

This is crucial for verifying that spans are being logged:

1. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. Type `Developer: Open Webview Developer Tools`
3. Select the Causable webview from the list
4. The DevTools console will open

### 5. Verify the Connection

In the Webview Developer Tools console, you should see:
- `✅ SSE connection established`
- `Connection confirmed: Timeline stream connected`

The UI should display "Connected" status with a green indicator.

### 6. Test Real-time Span Reception

To verify that spans are received in real-time:

1. **Manually insert a span into the database**:
   ```sql
   INSERT INTO ledger.universal_registry (
     id, seq, entity_type, who, "this", at
   ) VALUES (
     gen_random_uuid(), 
     1, 
     'test_event',
     'test_user',
     'test action',
     NOW()
   );
   ```

2. **Check the Webview Developer Tools Console**:
   - You should immediately see: `📊 New span received: {id: "...", seq: 1, ...}`
   - The full span JSON object will be logged

3. **Check the UI**:
   - The span should appear in the timeline list
   - It should display the entity type, time, and semantic triple

## Definition of Done Checklist

- [x] User can run `Causable: Set API Key` command
- [x] User can run `Causable: Set API URL` command
- [x] Extension's side panel establishes SSE connection on launch (when configured)
- [x] UI displays "Connected" status when connected
- [x] When a span is INSERTed into the database, its full JSON is logged to the Webview Developer Tools console
- [x] Connection errors are handled gracefully with "Error" or "Disconnected" state in UI
- [x] Auto-reconnection with exponential backoff is implemented

## Troubleshooting

### Connection Issues

- **"Disconnected" status**: Check that the backend is running on the configured URL
- **CORS errors**: Ensure the backend has CORS enabled (already configured in the router)
- **No spans appearing**: Verify the database trigger is working and the `timeline_updates` LISTEN channel is active

### Checking Backend Logs

When a new connection is established, the backend should log:
```
📡 New SSE connection established
📡 Listening for timeline_updates on PostgreSQL
```

When a span is inserted, it should trigger a notification that gets sent over the SSE stream.
