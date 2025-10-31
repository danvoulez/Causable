// Database connection and query utilities for PostgreSQL
// Uses Deno's PostgreSQL client

import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

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
 * Create a new database client connection
 */
export async function createClient(): Promise<Client> {
  const client = new Client(getDatabaseUrl());
  await client.connect();
  return client;
}

/**
 * Create a pooled database connection
 * For production use, this should use a proper connection pool
 */
export class DatabasePool {
  private client: Client | null = null;

  async getClient(): Promise<Client> {
    if (!this.client) {
      this.client = await createClient();
    }
    return this.client;
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }
}

// Singleton pool instance
export const dbPool = new DatabasePool();
