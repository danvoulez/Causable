// Database connection and query utilities for PostgreSQL
// Uses Deno's PostgreSQL client with connection pooling

import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import type { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

/**
 * Get database connection string from environment
 */
function getDatabaseUrl(): string {
  const url = Deno.env.get("DATABASE_URL");
  if (!url) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  return url;
}

/**
 * Production-grade connection pool using deno-postgres Pool
 */
export class DatabasePool {
  private pool: Pool;

  constructor() {
    const poolSize = parseInt(Deno.env.get("DB_POOL_SIZE") || "10");
    
    this.pool = new Pool(getDatabaseUrl(), poolSize, true);
    
    console.log(`✅ Database connection pool initialized with ${poolSize} connections`);
  }

  async getClient(): Promise<Client> {
    return await this.pool.connect();
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Singleton pool instance
export const dbPool = new DatabasePool();

/**
 * Create a standalone client for LISTEN/NOTIFY operations
 * These need a dedicated connection
 */
export async function createDedicatedClient(): Promise<Client> {
  const { Client } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
  const client = new Client(getDatabaseUrl());
  await client.connect();
  return client;
}
