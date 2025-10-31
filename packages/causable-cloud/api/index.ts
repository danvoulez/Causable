// Causable Cloud API - Main Entry Point
// Uses Deno's built-in HTTP server

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { router } from "./router.ts";

const PORT = parseInt(Deno.env.get("PORT") || "8000");

console.log(`🚀 Causable Cloud API starting on http://localhost:${PORT}`);

await serve(router, { port: PORT });
