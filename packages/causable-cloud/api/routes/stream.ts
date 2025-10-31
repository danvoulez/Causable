// SSE Stream endpoint for real-time updates
// In production, this would use PostgreSQL LISTEN/NOTIFY

import { addListener, removeListener } from "./spans.ts";

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
    start(controller) {
      console.log("📡 New SSE connection established");
      
      // Send initial connection event
      const connectMsg = `data: ${JSON.stringify({ type: "connected", message: "Timeline stream connected" })}\n\n`;
      controller.enqueue(new TextEncoder().encode(connectMsg));
      
      // Register listener for new spans
      const listener = (span: any) => {
        const msg = `data: ${JSON.stringify(span)}\n\n`;
        controller.enqueue(new TextEncoder().encode(msg));
      };
      
      addListener(listener);
      
      // Keep-alive ping every 30 seconds
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(": keep-alive\n\n"));
        } catch (error) {
          console.log("Keep-alive failed, cleaning up");
          clearInterval(keepAliveInterval);
        }
      }, 30000);
      
      // Cleanup on cancel
      return () => {
        console.log("📡 SSE connection closed");
        removeListener(listener);
        clearInterval(keepAliveInterval);
      };
    },
  });
  
  return new Response(stream, { headers: corsHeaders() });
}
