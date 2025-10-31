// SSE Stream endpoint for real-time updates
// Uses PostgreSQL LISTEN/NOTIFY for real-time span updates

import { createClient } from "../../lib/db.ts";

function corsHeaders(): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });
}

export async function handleStream(_req: Request): Promise<Response> {
  const stream = new ReadableStream({
    async start(controller) {
      console.log("📡 New SSE connection established");
      
      // Create dedicated database connection for LISTEN
      let client;
      let keepAliveInterval: number | undefined;
      
      try {
        client = await createClient();
        
        // Send initial connection event
        const connectMsg = `data: ${JSON.stringify({ type: "connected", message: "Timeline stream connected" })}\n\n`;
        controller.enqueue(new TextEncoder().encode(connectMsg));
        
        // Start listening for timeline_updates notifications
        await client.queryObject("LISTEN timeline_updates");
        console.log("📡 Listening for timeline_updates on PostgreSQL");
        
        // Set up notification handler
        client.channel.onmessage = (msg: any) => {
          try {
            // Parse the notification payload
            const span = JSON.parse(msg.payload);
            const data = `data: ${JSON.stringify(span)}\n\n`;
            controller.enqueue(new TextEncoder().encode(data));
          } catch (error) {
            console.error("Error processing notification:", error);
          }
        };
        
        // Keep-alive ping every 30 seconds
        keepAliveInterval = setInterval(() => {
          try {
            controller.enqueue(new TextEncoder().encode(": keep-alive\n\n"));
          } catch (error) {
            console.log("Keep-alive failed, cleaning up");
            if (keepAliveInterval !== undefined) {
              clearInterval(keepAliveInterval);
            }
          }
        }, 30000);
      } catch (error) {
        console.error("Error setting up SSE stream:", error);
        const errorMsg = `data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`;
        controller.enqueue(new TextEncoder().encode(errorMsg));
        controller.close();
        if (client) {
          try {
            await client.end();
          } catch (e) {
            console.error("Error closing client:", e);
          }
        }
      }
    },
    async cancel() {
      console.log("📡 SSE connection closed by client");
    },
  });
  
  return new Response(stream, { headers: corsHeaders() });
}
