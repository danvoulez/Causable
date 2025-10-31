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
  private connecting: Promise<Client> | null = null;

  async getClient(): Promise<Client> {
    // Return existing client if available
    if (this.client) {
      return this.client;
    }
    
    // If already connecting, wait for that connection
    if (this.connecting) {
      return this.connecting;
    }
    
    // Start new connection
    this.connecting = createClient();
    try {
      this.client = await this.connecting;
      return this.client;
    } finally {
      this.connecting = null;
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
    this.connecting = null;
  }
}

// Singleton pool instance
export const dbPool = new DatabasePool();
