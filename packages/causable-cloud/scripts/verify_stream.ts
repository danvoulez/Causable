#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Verification Script for SSE Stream
 * 
 * This script connects to the /api/timeline/stream endpoint and logs
 * any received messages to the console. Use this to verify that:
 * 1. The SSE endpoint is working
 * 2. PostgreSQL LISTEN/NOTIFY is functioning
 * 3. Manual INSERTs trigger real-time updates
 * 
 * Usage:
 *   deno run --allow-net --allow-env scripts/verify_stream.ts
 * 
 * Test by manually inserting a row:
 *   INSERT INTO ledger.universal_registry (id, seq, entity_type, who, "this", at)
 *   VALUES (gen_random_uuid(), 0, 'test', 'developer', 'verify_test', now());
 */

const API_URL = Deno.env.get("API_URL") || "http://localhost:8000";
const STREAM_URL = `${API_URL}/api/timeline/stream`;

console.log("🔍 Causable Stream Verification Tool");
console.log("=====================================");
console.log(`Connecting to: ${STREAM_URL}`);
console.log("Waiting for events... (Press Ctrl+C to exit)\n");

// Connect to the SSE stream
const response = await fetch(STREAM_URL);

if (!response.ok) {
  console.error(`❌ Failed to connect: ${response.status} ${response.statusText}`);
  Deno.exit(1);
}

if (!response.body) {
  console.error("❌ No response body received");
  Deno.exit(1);
}

console.log("✅ Connected to stream!\n");

// Read the stream line by line
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";

try {
  while (true) {
    const { value, done } = await reader.read();
    
    if (done) {
      console.log("\n📡 Stream ended");
      break;
    }
    
    // Decode the chunk and add to buffer
    buffer += decoder.decode(value, { stream: true });
    
    // Process complete lines
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep the incomplete line in buffer
    
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.substring(6); // Remove "data: " prefix
        
        try {
          const event = JSON.parse(data);
          
          // Format the output based on event type
          if (event.type === "connected") {
            console.log(`📡 ${event.message}`);
          } else if (event.type === "error") {
            console.error(`❌ Error: ${event.error}`);
          } else {
            // This is a span object
            const timestamp = new Date().toISOString();
            console.log(`\n[${timestamp}] New Span Received:`);
            console.log("─".repeat(50));
            console.log(JSON.stringify(event, null, 2));
            console.log("─".repeat(50));
            
            // Also log a summary
            const summary = `  ${event.who || "?"} ${event.did || "?"} ${event.this || "?"} [${event.entity_type}]`;
            console.log(`  Summary: ${summary}`);
          }
        } catch (error) {
          console.error(`⚠️  Failed to parse event: ${data}`);
        }
      } else if (line.startsWith(": ")) {
        // Keep-alive comment
        const keepAliveMsg = line.substring(2);
        if (keepAliveMsg === "keep-alive") {
          Deno.stdout.writeSync(new TextEncoder().encode("."));
        }
      }
    }
  }
} catch (error) {
  console.error(`\n❌ Stream error: ${error.message}`);
  Deno.exit(1);
}
