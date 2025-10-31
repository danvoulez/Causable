// Spans REST endpoint - GET and POST
// Connects to PostgreSQL ledger.universal_registry table

import { dbPool } from "../../lib/db.ts";

interface Span {
  id: string;
  seq: number;
  entity_type: string;
  who: string;
  did?: string;
  this: string;
  at: string;
  status?: string;
  [key: string]: any;
}

function corsHeaders(): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  });
}

export async function handleSpans(req: Request): Promise<Response> {
  const url = new URL(req.url);
  
  if (req.method === "GET") {
    try {
      // Parse query parameters for filtering
      const entity_type = url.searchParams.get("entity_type");
      const status = url.searchParams.get("status");
      const trace_id = url.searchParams.get("trace_id");
      const limit = parseInt(url.searchParams.get("limit") || "50");
      
      const client = await dbPool.getClient();
      
      // Build query with filters
      let query = "SELECT * FROM ledger.universal_registry WHERE is_deleted = false";
      const params: any[] = [];
      let paramIndex = 1;
      
      if (entity_type) {
        query += ` AND entity_type = $${paramIndex}`;
        params.push(entity_type);
        paramIndex++;
      }
      
      if (status) {
        query += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }
      
      if (trace_id) {
        query += ` AND trace_id = $${paramIndex}`;
        params.push(trace_id);
        paramIndex++;
      }
      
      query += ` ORDER BY at DESC LIMIT $${paramIndex}`;
      params.push(limit);
      
      const result = await client.queryObject<Span>(query, params);
      
      return new Response(JSON.stringify(result.rows), { headers: corsHeaders() });
    } catch (error) {
      console.error("Error fetching spans:", error);
      const headers = corsHeaders();
      return new Response(
        JSON.stringify({ error: error.message || "Failed to fetch spans" }),
        { status: 500, headers }
      );
    }
  }
  
  if (req.method === "POST") {
    try {
      const body = await req.json();
      
      // Prepare span data with defaults
      const spanData = {
        id: body.id || crypto.randomUUID(),
        seq: body.seq ?? 0,
        entity_type: body.entity_type || "unknown",
        who: body.who || "unknown",
        did: body.did || null,
        this: body.this || "unknown",
        at: body.at ? new Date(body.at) : new Date(),
        parent_id: body.parent_id || null,
        related_to: body.related_to || null,
        owner_id: body.owner_id || null,
        tenant_id: body.tenant_id || null,
        visibility: body.visibility || "private",
        status: body.status || null,
        name: body.name || null,
        description: body.description || null,
        code: body.code || null,
        language: body.language || null,
        runtime: body.runtime || null,
        input: body.input || null,
        output: body.output || null,
        error: body.error || null,
        duration_ms: body.duration_ms || null,
        trace_id: body.trace_id || null,
        prev_hash: body.prev_hash || null,
        curr_hash: body.curr_hash || null,
        signature: body.signature || null,
        public_key: body.public_key || null,
        metadata: body.metadata || null,
      };
      
      const client = await dbPool.getClient();
      
      // Insert into database
      const insertQuery = `
        INSERT INTO ledger.universal_registry (
          id, seq, entity_type, who, did, "this", at,
          parent_id, related_to, owner_id, tenant_id, visibility,
          status, name, description, code, language, runtime,
          input, output, error, duration_ms, trace_id,
          prev_hash, curr_hash, signature, public_key, metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23,
          $24, $25, $26, $27, $28
        ) RETURNING *
      `;
      
      const result = await client.queryObject<Span>(insertQuery, [
        spanData.id, spanData.seq, spanData.entity_type, spanData.who, 
        spanData.did, spanData.this, spanData.at,
        spanData.parent_id, spanData.related_to, spanData.owner_id, 
        spanData.tenant_id, spanData.visibility,
        spanData.status, spanData.name, spanData.description, spanData.code, 
        spanData.language, spanData.runtime,
        spanData.input, spanData.output, spanData.error, spanData.duration_ms, 
        spanData.trace_id,
        spanData.prev_hash, spanData.curr_hash, spanData.signature, 
        spanData.public_key, spanData.metadata,
      ]);
      
      // The PostgreSQL trigger will automatically NOTIFY timeline_updates
      const createdSpan = result.rows[0];
      
      return new Response(JSON.stringify(createdSpan), { headers: corsHeaders() });
    } catch (error) {
      console.error("Error creating span:", error);
      const headers = corsHeaders();
      return new Response(
        JSON.stringify({ error: error.message || "Failed to create span" }),
        { status: 500, headers }
      );
    }
  }
  
  return new Response("Method Not Allowed", { status: 405, headers: corsHeaders() });
}
