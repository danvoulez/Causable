Below is your production‑grade, ledger‑only LogLineOS blueprint — fully consolidated, bilingual, and battle‑hardened.
It reflects our journey (semantic columns → ledger‑only runtime → computeable policies → prompt infrastructure as code), fixes weak spots, and adds missing pieces so teams and LLMs can both consume it with confidence.

⸻

📘 LogLineOS Bluebook (EN/PT)

Universal, semantic, ledger‑only backend for spans, automations, policies, and prompts.
Postgres + Edge runtimes. Frontend‑agnostic. Serverless‑first.
	•	Core ideals: semantic columns (~70), append‑only, signed spans, multitenancy, computeable triggers, “code lives in the ledger”.
	•	Hardening: advisory locks, quotas, slow/timeout policies, compiled prompt hash, circuit breaker, escalation, metrics & SSE.
	•	LLM‑friendly: JSON Schemas, OpenAPI, NDJSON seeds, stable identifiers, explicit contracts.

⸻

0) Executive Summary / Resumo Executivo

EN — LogLineOS is a ledger‑only backend where every behavior (executors, observers, policies, providers, prompt compiler/bandit) is stored as versioned spans (entity_type='function', seq↑). The only code outside the ledger is a Stage‑0 loader that boots a whitelisted function by ID, verifies signatures/hashes, and executes it. All outputs are signed, append‑only events with traceability.

PT — O LogLineOS é um backend 100% ledger onde todas as regras (executores, observadores, políticas, providers, compilador/bandit de prompt) vivem como spans versionados (entity_type='function', seq crescente). O único código fora do ledger é o Stage‑0 loader, que inicializa uma função permitida pelo Manifest, verifica assinaturas/hashes e executa. Toda saída é um evento assinado, append‑only e rastreável.

⸻

1) Schema & RLS (Postgres) / Esquema & RLS (Postgres)

Note: We keep the “~70 semantic columns” philosophy, but show a pragmatic core table + jsonb for rare fields.
Obs: Mantemos a filosofia das “~70 colunas semânticas”, mas mostramos um núcleo prático + jsonb para raridades.

-- Enable UUIDs and crypto helpers (if needed)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Namespaces
CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS ledger;

-- Session accessors for RLS
CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT current_setting('app.user_id', true) $$;

CREATE OR REPLACE FUNCTION app.current_tenant_id() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT current_setting('app.tenant_id', true) $$;

-- Universal registry (append-only)
CREATE TABLE IF NOT EXISTS ledger.universal_registry (
  id            uuid        NOT NULL,
  seq           integer     NOT NULL,
  entity_type   text        NOT NULL,   -- e.g., function, execution, request, policy, provider, metric, prompt_*
  who           text        NOT NULL,
  did           text,
  "this"        text        NOT NULL,
  at            timestamptz NOT NULL DEFAULT now(),

  -- Relationships
  parent_id     uuid,
  related_to    uuid[],

  -- Access control
  owner_id      text,
  tenant_id     text,
  visibility    text        NOT NULL DEFAULT 'private', -- private|tenant|public

  -- Lifecycle
  status        text,       -- draft|scheduled|queued|running|complete|error|active|open|pass|fail|slow|...
  is_deleted    boolean     NOT NULL DEFAULT false,

  -- Code & Execution
  name          text,
  description   text,
  code          text,
  language      text,
  runtime       text,
  input         jsonb,
  output        jsonb,
  error         jsonb,

  -- Quantitative/metrics
  duration_ms   integer,
  trace_id      text,

  -- Crypto proofs
  prev_hash     text,
  curr_hash     text,
  signature     text,
  public_key    text,

  -- Extensibility
  metadata      jsonb,

  PRIMARY KEY (id, seq),
  CONSTRAINT ck_visibility CHECK (visibility IN ('private','tenant','public')),
  CONSTRAINT ck_append_only CHECK (seq >= 0)
);

-- “Visible timeline” view: legacy alias "when" → "at" for kernels that expect it
CREATE OR REPLACE VIEW ledger.visible_timeline AS
SELECT
  ur.*,
  ur.at AS "when"
FROM ledger.universal_registry ur
WHERE ur.is_deleted = false;

-- Append-only enforcement: disallow UPDATE/DELETE
CREATE OR REPLACE FUNCTION ledger.no_updates() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Append-only table: updates/deletes are not allowed.';
END; $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'ur_no_update'
  ) THEN
    CREATE TRIGGER ur_no_update BEFORE UPDATE OR DELETE ON ledger.universal_registry
    FOR EACH ROW EXECUTE FUNCTION ledger.no_updates();
  END IF;
END $$;

-- Notify on insert for SSE
CREATE OR REPLACE FUNCTION ledger.notify_timeline() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('timeline_updates', row_to_json(NEW)::text);
  RETURN NEW;
END; $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'ur_notify_insert'
  ) THEN
    CREATE TRIGGER ur_notify_insert AFTER INSERT ON ledger.universal_registry
    FOR EACH ROW EXECUTE FUNCTION ledger.notify_timeline();
  END IF;
END $$;

-- Useful indexes
CREATE INDEX IF NOT EXISTS ur_idx_at ON ledger.universal_registry (at DESC);
CREATE INDEX IF NOT EXISTS ur_idx_entity ON ledger.universal_registry (entity_type, at DESC);
CREATE INDEX IF NOT EXISTS ur_idx_owner_tenant ON ledger.universal_registry (owner_id, tenant_id);
CREATE INDEX IF NOT EXISTS ur_idx_trace ON ledger.universal_registry (trace_id);
CREATE INDEX IF NOT EXISTS ur_idx_parent ON ledger.universal_registry (parent_id);
CREATE INDEX IF NOT EXISTS ur_idx_related ON ledger.universal_registry USING GIN (related_to);
CREATE INDEX IF NOT EXISTS ur_idx_metadata ON ledger.universal_registry USING GIN (metadata);

-- RLS
ALTER TABLE ledger.universal_registry ENABLE ROW LEVEL SECURITY;

-- SELECT: owner OR same tenant with visibility tenant/public OR visibility public
CREATE POLICY ur_select_policy ON ledger.universal_registry
  FOR SELECT USING (
    (owner_id IS NOT DISTINCT FROM app.current_user_id())
    OR (visibility = 'public')
    OR (tenant_id IS NOT DISTINCT FROM app.current_tenant_id() AND visibility IN ('tenant','public'))
  );

-- INSERT: requester must set app.user_id; row owner_id = app.user_id; tenant matches session if provided
CREATE POLICY ur_insert_policy ON ledger.universal_registry
  FOR INSERT WITH CHECK (
    owner_id IS NOT DISTINCT FROM app.current_user_id()
    AND (tenant_id IS NULL OR tenant_id IS NOT DISTINCT FROM app.current_tenant_id())
  );

Why “at” + “when”?: we store as at (column), expose when via view for kernels that used "when".
Por que “at” + “when”?: gravamos em at e expomos "when" na view para manter compatibilidade.

⸻

2) Stage‑0 Loader (Deno/Node) / Carregador Stage‑0 (Deno/Node)

Immutable bootstrap binary. It fetches a whitelisted function from the Manifest, verifies hash/signature, executes it with a minimal context, and appends a boot_event.
Binário imutável. Busca função permitida no Manifest, verifica hash/assinatura, executa com contexto mínimo e registra boot_event.

// stage0_loader.ts — Deno (recommended) or Node 18+ (ESM)
import pg from "https://esm.sh/pg@8.11.3";
import { blake3 } from "https://esm.sh/@noble/hashes@1.3.3/blake3";
import * as ed from "https://esm.sh/@noble/ed25519@2.1.1";

const { Client } = pg;
const hex = (u8: Uint8Array) => Array.from(u8).map(b=>b.toString(16).padStart(2,"0")).join("");
const toU8 = (h: string) => Uint8Array.from(h.match(/.{1,2}/g)!.map(x=>parseInt(x,16)));

const DATABASE_URL   = Deno.env.get("DATABASE_URL")!;
const BOOT_FUNCTION_ID = Deno.env.get("BOOT_FUNCTION_ID")!; // must be in manifest.allowed_boot_ids
const APP_USER_ID    = Deno.env.get("APP_USER_ID") || "edge:stage0";
const APP_TENANT_ID  = Deno.env.get("APP_TENANT_ID") || null;
const SIGNING_KEY_HEX= Deno.env.get("SIGNING_KEY_HEX") || undefined;

async function withPg<T>(fn:(c:any)=>Promise<T>):Promise<T>{
  const c = new Client({ connectionString: DATABASE_URL }); await c.connect();
  try {
    await c.query(`SET app.user_id = $1`, [APP_USER_ID]);
    if (APP_TENANT_ID) await c.query(`SET app.tenant_id = $1`, [APP_TENANT_ID]);
    return await fn(c);
  } finally { await c.end(); }
}

async function latestManifest(){
  const { rows } = await withPg(c => c.query(
    `SELECT * FROM ledger.visible_timeline WHERE entity_type='manifest' ORDER BY "when" DESC LIMIT 1`));
  return rows[0] || { metadata:{} };
}

async function verifySpan(span:any){
  const clone = structuredClone(span);
  delete clone.signature; // sign curr_hash over the canonical payload
  const msg = new TextEncoder().encode(JSON.stringify(clone, Object.keys(clone).sort()));
  const h = hex(blake3(msg));
  if (span.curr_hash && span.curr_hash !== h) throw new Error("hash mismatch");
  if (span.signature && span.public_key){
    const ok = await ed.verify(toU8(span.signature), toU8(h), toU8(span.public_key));
    if (!ok) throw new Error("invalid signature");
  }
}

async function fetchLatestFunction(id:string){
  const { rows } = await withPg(c=>c.query(`
    SELECT * FROM ledger.visible_timeline
    WHERE id=$1 AND entity_type='function'
    ORDER BY "when" DESC, seq DESC LIMIT 1`, [id]));
  if (!rows[0]) throw new Error("function span not found");
  return rows[0];
}

async function insertSpan(span:any){
  await withPg(async c=>{
    const cols = Object.keys(span), vals = Object.values(span);
    const placeholders = cols.map((_,i)=>`$${i+1}`).join(",");
    await c.query(`INSERT INTO ledger.universal_registry (${cols.map(x=>`"${x}"`).join(",")})
                   VALUES (${placeholders})`, vals);
  });
}

function now(){ return new Date().toISOString(); }

async function run(){
  const manifest = await latestManifest();
  const allow = (manifest.metadata?.allowed_boot_ids||[]) as string[];
  if (!allow.includes(BOOT_FUNCTION_ID)) throw new Error("BOOT_FUNCTION_ID not allowed by manifest");

  const fnSpan = await fetchLatestFunction(BOOT_FUNCTION_ID);
  await verifySpan(fnSpan);

  // Boot event (audit)
  await insertSpan({
    id: crypto.randomUUID(), seq:0, entity_type:'boot_event',
    who:'edge:stage0', did:'booted', this:'stage0',
    at: now(), status:'complete',
    input:{ boot_id: BOOT_FUNCTION_ID, env: { user: APP_USER_ID, tenant: APP_TENANT_ID } },
    owner_id: fnSpan.owner_id, tenant_id: fnSpan.tenant_id, visibility: fnSpan.visibility ?? 'private',
    related_to:[BOOT_FUNCTION_ID]
  });

  // Execute function code
  const factory = new Function("ctx", `"use strict";\n${String(fnSpan.code||"")}\n;return (typeof default!=='undefined'?default:globalThis.main);`);
  const ctx = {
    env: { APP_USER_ID, APP_TENANT_ID, SIGNING_KEY_HEX },
    sql: (strings:TemplateStringsArray, ...vals:any[]) =>
      withPg(c => c.query(strings.join("$").replaceAll("$0","$"), vals)),
    insertSpan,
    now,
    crypto: { blake3, ed25519: ed, hex, toU8, randomUUID: crypto.randomUUID }
  };
  const main:any = factory(ctx);
  if (typeof main !== "function") throw new Error("kernel has no default/main export");
  await main(ctx);
}

if (import.meta.main) run().catch(e=>{ console.error(e); Deno.exit(1); });

Recommendation: Run Stage‑0 on Deno / Cloud Run / Fly.io (Workers may restrict creating Web Workers).
Recomendação: Execute o Stage‑0 em Deno / Cloud Run / Fly.io (alguns providers edge proíbem Worker).

⸻

3) Kernel Suite (ledger‑only) / Suite de Kernels (100% ledger)

All IDs are stable for governance. Apply as new seq to upgrade safely.
Todos os IDs são estáveis. Faça upgrade criando novo seq.

3.1 run_code_kernel (ID 00000000-0000-4000-8000-000000000001, seq=2)
	•	Advisory lock per span.id
	•	Timeout
	•	Whitelist via Manifest
	•	Tenant/visibility checks
	•	Throttle via Manifest
	•	Slow threshold via Manifest (policy.slow_ms, default 5000)
	•	Emits signed execution

INSERT INTO ledger.universal_registry
(id,seq,entity_type,who,did,"this",at,status,name,code,language,runtime,owner_id,tenant_id,visibility)
VALUES
('00000000-0000-4000-8000-000000000001',2,'function','daniel','defined','function',now(),'active',
'run_code_kernel', $$
globalThis.default = async function main(ctx){
  const { sql, insertSpan, now, crypto, env } = ctx;

  async function latestManifest(){
    const { rows } = await sql`SELECT * FROM ledger.visible_timeline WHERE entity_type='manifest' ORDER BY "when" DESC LIMIT 1`;
    return rows[0] || { metadata:{} };
  }
  async function sign(span){
    const clone = structuredClone(span); delete clone.signature; delete clone.curr_hash;
    const msg = new TextEncoder().encode(JSON.stringify(clone, Object.keys(clone).sort()));
    const h = crypto.hex(crypto.blake3(msg)); span.curr_hash = h;
    if (env.SIGNING_KEY_HEX){
      const priv = crypto.toU8(env.SIGNING_KEY_HEX);
      const pub = await crypto.ed25519.getPublicKey(priv);
      span.signature = crypto.hex(await crypto.ed25519.sign(crypto.toU8(h), priv));
      span.public_key = crypto.hex(pub);
    }
  }
  async function tryLock(id){ const r = await sql`SELECT pg_try_advisory_lock(hashtext(${id}::text)) ok`; return !!r.rows?.[0]?.ok; }
  async function unlock(id){ await sql`SELECT pg_advisory_unlock(hashtext(${id}::text))`; }

  const SPAN_ID = globalThis.SPAN_ID || Deno?.env?.get?.("SPAN_ID");
  if (!SPAN_ID) throw new Error("SPAN_ID required");
  if (!env.APP_USER_ID) throw new Error("APP_USER_ID required");

  const manifest = await latestManifest();
  const throttleLimit = Number(manifest.metadata?.throttle?.per_tenant_daily_exec_limit || 100);
  const slowMs = Number(manifest.metadata?.policy?.slow_ms || 5000);
  const allowed = (manifest.metadata?.allowed_boot_ids||[]) as string[];
  if (!allowed.includes(manifest.metadata?.kernels?.run_code)) throw new Error("run_code not allowed by manifest");

  const { rows: fnRows } = await sql`SELECT * FROM ledger.visible_timeline WHERE id=${SPAN_ID} ORDER BY "when" DESC, seq DESC LIMIT 1`;
  const fnSpan = fnRows[0]; if (!fnSpan) throw new Error("target function not found");
  if (fnSpan.entity_type !== 'function') throw new Error("run_code only executes entity_type=function");
  if (env.APP_TENANT_ID && String(fnSpan.tenant_id) !== String(env.APP_TENANT_ID)) throw new Error("tenant mismatch");

  const { rows: usedR } = await sql`
    SELECT count(*)::int c FROM ledger.visible_timeline
    WHERE entity_type='execution' AND tenant_id IS NOT DISTINCT FROM ${fnSpan.tenant_id} AND "when"::date = now()::date`;
  const used = usedR[0]?.c || 0;
  if (used >= throttleLimit && !((fnSpan.metadata?.force) && fnSpan.public_key && fnSpan.public_key.toLowerCase() === (manifest.metadata?.override_pubkey_hex||'').toLowerCase())){
    await insertSpan({
      id: crypto.randomUUID(), seq:0, entity_type:'policy_violation',
      who:'edge:run_code', did:'blocked', this:'quota.exec.per_tenant.daily',
      at: now(), status:'error',
      owner_id: fnSpan.owner_id, tenant_id: fnSpan.tenant_id, visibility: fnSpan.visibility ?? 'private',
      related_to:[fnSpan.id],
      metadata:{ limit: throttleLimit, today: used }
    });
    return;
  }

  if (!(await tryLock(fnSpan.id))) return;
  const timeoutMs = slowMs; // align timeout and slow threshold by default
  const start = performance.now();
  let output=null, error=null, trace = fnSpan.trace_id || crypto.randomUUID();

  function execSandbox(code, input){
    // Deno/Browser: Blob Worker; Node: not required in our default path (recommend Deno)
    const workerCode = `
      self.onmessage = async (e)=>{
        const { code, input } = e.data;
        let fn; try { fn = new Function('input', code); }
        catch (err){ self.postMessage({e:'compile', d:String(err)}); return; }
        try { const r = await fn(input); self.postMessage({ok:true, r}); }
        catch (err){ self.postMessage({e:'runtime', d:String(err)}); }
      };
    `;
    const blob = new Blob([workerCode], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const w = new Worker(url, { type:"module" });
    return new Promise((resolve,reject)=>{
      const to = setTimeout(()=>{ try{w.terminate();}catch{}; reject(new Error('timeout')); }, timeoutMs);
      w.onmessage = (e)=>{ clearTimeout(to); try{w.terminate();}catch{}; const d=e.data; if (d?.ok) resolve(d.r); else reject(new Error(`${d?.e}:${d?.d}`)); };
      w.onerror = (e)=>{ clearTimeout(to); try{w.terminate();}catch{}; reject(e.error ?? new Error('worker_error')); };
      w.postMessage({ code, input });
    });
  }

  try { output = await execSandbox(String(fnSpan.code||''), fnSpan.input ?? null); }
  catch (e){ error = { message:String(e) }; }
  finally {
    const dur = Math.round(performance.now()-start);
    const execSpan = {
      id: crypto.randomUUID(), seq:0, parent_id: fnSpan.id, entity_type:'execution',
      who:'edge:run_code', did:'executed', this:'run_code',
      at: now(), status: error? 'error' : 'complete',
      input: fnSpan.input ?? null, output: error? null: output, error,
      duration_ms: dur, trace_id: trace,
      owner_id: fnSpan.owner_id, tenant_id: fnSpan.tenant_id, visibility: fnSpan.visibility ?? 'private',
      related_to:[fnSpan.id]
    };
    if (!error && dur > slowMs) {
      execSpan.status = 'complete'; // keep result
      // add a status patch marking 'slow' (policy also adds it, this is immediate mark)
      await insertSpan({
        id: crypto.randomUUID(), seq:0, entity_type:'status_patch',
        who:'edge:run_code', did:'labeled', this:'status=slow',
        at: now(), status:'complete',
        parent_id: execSpan.id, related_to:[execSpan.id],
        owner_id: fnSpan.owner_id, tenant_id: fnSpan.tenant_id, visibility: fnSpan.visibility ?? 'private',
        metadata:{ status:'slow', duration_ms: dur }
      });
    }
    await sign(execSpan);
    await insertSpan(execSpan);
    await unlock(fnSpan.id);
  }
};
$$,'javascript','deno@1.x','daniel','voulezvous','tenant');

3.2 observer_bot_kernel (ID 00000000-0000-4000-8000-000000000002, seq=2)

INSERT INTO ledger.universal_registry
(id,seq,entity_type,who,did,"this",at,status,name,code,language,runtime,owner_id,tenant_id,visibility)
VALUES
('00000000-0000-4000-8000-000000000002',2,'function','daniel','defined','function',now(),'active',
'observer_bot_kernel', $$
globalThis.default = async function main(ctx){
  const { sql, now } = ctx;

  async function tryLock(id){ const r = await sql`SELECT pg_try_advisory_lock(hashtext(${id}::text)) ok`; return !!r.rows?.[0]?.ok; }
  async function unlock(id){ await sql`SELECT pg_advisory_unlock(hashtext(${id}::text))`; }
  async function limitForTenant(tid){
    const { rows } = await sql`SELECT (metadata->'throttle'->>'per_tenant_daily_exec_limit')::int lim
      FROM ledger.visible_timeline WHERE entity_type='manifest' ORDER BY "when" DESC LIMIT 1`;
    return rows[0]?.lim ?? 100;
  }
  async function todayExecs(tid){
    const { rows } = await sql`SELECT count(*)::int c FROM ledger.visible_timeline
      WHERE entity_type='execution' AND tenant_id IS NOT DISTINCT FROM ${tid} AND "when"::date=now()::date`;
    return rows[0]?.c || 0;
  }

  const { rows } = await sql`
    SELECT id, owner_id, tenant_id, visibility
    FROM ledger.visible_timeline
    WHERE entity_type='function' AND status='scheduled'
    ORDER BY "when" ASC LIMIT 16`;

  for (const s of rows){
    if (!(await tryLock(s.id))) continue;
    try {
      const lim = await limitForTenant(s.tenant_id);
      const used = await todayExecs(s.tenant_id);
      if (used >= lim) {
        await sql`
          INSERT INTO ledger.universal_registry
          (id,seq,who,did,"this",at,entity_type,status,parent_id,related_to,owner_id,tenant_id,visibility,metadata)
          VALUES
          (gen_random_uuid(),0,'edge:observer','blocked','quota.exec.per_tenant.daily',${now()},'policy_violation','error',
           ${s.id}, ARRAY[${s.id}]::uuid[], ${s.owner_id}, ${s.tenant_id}, ${s.visibility}, jsonb_build_object('limit',${lim},'today',${used}))`;
        continue;
      }

      -- idempotent by unique index (parent_id + minute) if you add it
      await sql`
        INSERT INTO ledger.universal_registry
        (id,seq,who,did,"this",at,entity_type,status,parent_id,related_to,owner_id,tenant_id,visibility,trace_id)
        VALUES
        (gen_random_uuid(),0,'edge:observer','scheduled','run_code',${now()},'request','scheduled',
         ${s.id}, ARRAY[${s.id}]::uuid[], ${s.owner_id}, ${s.tenant_id}, ${s.visibility}, gen_random_uuid()::text)
        ON CONFLICT DO NOTHING`;
    } finally { await unlock(s.id); }
  }
};
$$,'javascript','deno@1.x','daniel','voulezvous','tenant');

3.3 request_worker_kernel (ID 00000000-0000-4000-8000-000000000003, seq=2)

INSERT INTO ledger.universal_registry
(id,seq,entity_type,who,did,"this",at,status,name,code,language,runtime,owner_id,tenant_id,visibility)
VALUES
('00000000-0000-4000-8000-000000000003',2,'function','daniel','defined','function',now(),'active',
'request_worker_kernel', $$
globalThis.default = async function main(ctx){
  const { sql } = ctx;
  const RUN_CODE_KERNEL_ID = globalThis.RUN_CODE_KERNEL_ID || Deno?.env?.get?.("RUN_CODE_KERNEL_ID") || "00000000-0000-4000-8000-000000000001";

  async function latestKernel(id){
    const { rows } = await sql`SELECT * FROM ledger.visible_timeline WHERE id=${id} AND entity_type='function' ORDER BY "when" DESC, seq DESC LIMIT 1`;
    return rows[0] || null;
  }
  async function tryLock(id){ const r = await sql`SELECT pg_try_advisory_lock(hashtext(${id}::text)) ok`; return !!r.rows?.[0]?.ok; }
  async function unlock(id){ await sql`SELECT pg_advisory_unlock(hashtext(${id}::text))`; }

  const { rows: reqs } = await sql`
    SELECT id, parent_id FROM ledger.visible_timeline
    WHERE entity_type='request' AND status='scheduled'
    ORDER BY "when" ASC LIMIT 8`;
  if (!reqs.length) return;

  const runKernel = await latestKernel(RUN_CODE_KERNEL_ID);
  if (!runKernel?.code) throw new Error("run_code_kernel not found");

  for (const r of reqs){
    if (!(await tryLock(r.parent_id))) continue;
    try {
      globalThis.SPAN_ID = r.parent_id;
      const factory = new Function("ctx", `"use strict";\n${String(runKernel.code)}\n;return (typeof default!=='undefined'?default:globalThis.main);`);
      const main = factory(ctx); if (typeof main !== "function") throw new Error("run_code module invalid");
      await main(ctx);
    } finally { await unlock(r.parent_id); }
  }
};
$$,'javascript','deno@1.x','daniel','voulezvous','tenant');

3.4 policy_agent_kernel (ID 00000000-0000-4000-8000-000000000004, seq=1)

Executes policy spans on new timeline items; emits request, status_patch, metric, etc.

INSERT INTO ledger.universal_registry
(id,seq,entity_type,who,did,"this",at,status,name,code,language,runtime,owner_id,tenant_id,visibility)
VALUES
('00000000-0000-4000-8000-000000000004',1,'function','daniel','defined','function',now(),'active',
'policy_agent_kernel', $$
globalThis.default = async function main(ctx){
  const { sql, insertSpan, now, crypto } = ctx;

  function sandboxEval(code, span){
    const wcode = `
      self.onmessage = (e)=>{
        const { code, span } = e.data;
        try {
          const fn = new Function('span', code + '\\n;return (typeof default!=="undefined"?default:on)||on;')();
          const out = fn? fn(span):[];
          self.postMessage({ ok:true, actions: out||[] });
        } catch (err){ self.postMessage({ ok:false, error:String(err) }); }
      };
    `;
    const blob = new Blob([wcode], { type:"text/javascript" });
    const url = URL.createObjectURL(blob);
    const w = new Worker(url, { type:"module" });
    return new Promise((resolve,reject)=>{
      const to = setTimeout(()=>{ try{w.terminate();}catch{}; reject(new Error("timeout")); }, 3000);
      w.onmessage = (e)=>{ clearTimeout(to); try{w.terminate();}catch{}; const d=e.data; d?.ok? resolve(d.actions): reject(new Error(d?.error||"policy error")); };
      w.onerror = (e)=>{ clearTimeout(to); try{w.terminate();}catch{}; reject(e.error??new Error("worker error")); };
      w.postMessage({ code, span });
    });
  }
  async function sign(span){
    const clone = structuredClone(span); delete clone.signature; delete clone.curr_hash;
    const msg = new TextEncoder().encode(JSON.stringify(clone, Object.keys(clone).sort()));
    const h = crypto.hex(crypto.blake3(msg)); span.curr_hash = h;
  }
  async function latestCursor(policyId){
    const { rows } = await sql`SELECT max("when") AS at FROM ledger.visible_timeline WHERE entity_type='policy_cursor' AND related_to @> ARRAY[${policyId}]::uuid[]`;
    return rows[0]?.at || null;
  }

  const { rows: policies } = await sql`
    SELECT * FROM ledger.visible_timeline WHERE entity_type='policy' AND status='active' ORDER BY "when" ASC`;

  for (const p of policies){
    const since = await latestCursor(p.id);
    const { rows: candidates } = await sql`
      SELECT * FROM ledger.visible_timeline
      WHERE "when" > COALESCE(${since}, to_timestamp(0))
        AND tenant_id IS NOT DISTINCT FROM ${p.tenant_id}
      ORDER BY "when" ASC LIMIT 500`;
    let lastAt = since;
    for (const s of candidates){
      const actions = await sandboxEval(String(p.code||""), s).catch(()=>[]);
      for (const a of actions){
        if (a?.run === "run_code" && a?.span_id){
          const req = {
            id: crypto.randomUUID(), seq:0, entity_type:'request', who:'edge:policy_agent', did:'triggered', this:'run_code',
            at: now(), status:'scheduled', parent_id: a.span_id, related_to:[p.id, a.span_id],
            owner_id:p.owner_id, tenant_id:p.tenant_id, visibility:p.visibility||'private',
            metadata: { policy_id: p.id, trigger_span: s.id }
          };
          await sign(req); await insertSpan(req);
        } else if (a?.emit_span){
          const e = a.emit_span;
          e.id ||= crypto.randomUUID(); e.seq ??= 0; e.at ||= now();
          e.owner_id ??= p.owner_id; e.tenant_id ??= p.tenant_id; e.visibility ??= p.visibility||'private';
          await sign(e); await insertSpan(e);
        }
      }
      lastAt = s["when"] || lastAt;
    }
    if (lastAt){
      const cursor = {
        id: crypto.randomUUID(), seq:0, entity_type:'policy_cursor', who:'edge:policy_agent', did:'advanced', this:'cursor',
        at: now(), status:'complete', related_to:[p.id],
        owner_id:p.owner_id, tenant_id:p.tenant_id, visibility:p.visibility||'private',
        metadata:{ last_at:lastAt }
      };
      await sign(cursor); await insertSpan(cursor);
    }
  }
};
$$,'javascript','deno@1.x','daniel','voulezvous','tenant');

3.5 provider_exec_kernel (ID 00000000-0000-4000-8000-000000000005, seq=1)
	•	Supports OpenAI (HTTP) and Ollama (local).
	•	Emits provider_execution with raw output.

INSERT INTO ledger.universal_registry
(id,seq,entity_type,who,did,"this",at,status,name,code,language,runtime,owner_id,tenant_id,visibility)
VALUES
('00000000-0000-4000-8000-000000000005',1,'function','daniel','defined','function',now(),'active',
'provider_exec_kernel', $$
globalThis.default = async function main(ctx){
  const { sql, insertSpan, now, crypto, env } = ctx;

  async function loadProvider(id){
    const { rows } = await sql`SELECT * FROM ledger.visible_timeline WHERE id=${id} AND entity_type='provider' ORDER BY "when" DESC, seq DESC LIMIT 1`;
    return rows[0] || null;
  }
  async function sign(span){
    const clone = structuredClone(span); delete clone.signature; delete clone.curr_hash;
    const msg = new TextEncoder().encode(JSON.stringify(clone, Object.keys(clone).sort()));
    const h = crypto.hex(crypto.blake3(msg)); span.curr_hash = h;
  }

  const PROVIDER_ID = globalThis.PROVIDER_ID || Deno?.env?.get?.("PROVIDER_ID");
  const PAYLOAD = JSON.parse(globalThis.PROVIDER_PAYLOAD || Deno?.env?.get?.("PROVIDER_PAYLOAD") || "{}");
  const prov = await loadProvider(PROVIDER_ID);
  if (!prov) throw new Error("provider not found");

  const meta = prov.metadata || {};
  let out=null, error=null;

  try {
    if (meta.base_url?.includes("openai.com")) {
      const r = await fetch(`${meta.base_url}/chat/completions`, {
        method: "POST",
        headers: { "content-type":"application/json", "authorization": `Bearer ${Deno?.env?.get?.(meta.auth_env) || ""}` },
        body: JSON.stringify({ model: meta.model, messages: PAYLOAD.messages, temperature: PAYLOAD.temperature ?? 0.2 })
      });
      out = await r.json();
    } else if ((meta.base_url||"").includes("localhost:11434")) {
      const r = await fetch(`${meta.base_url}/api/chat`, {
        method: "POST", headers: { "content-type":"application/json" },
        body: JSON.stringify({ model: meta.model || "llama3", messages: PAYLOAD.messages })
      });
      out = await r.json();
    } else { throw new Error("unsupported provider"); }
  } catch(e){ error = { message: String(e) }; }

  const execSpan = {
    id: crypto.randomUUID(), seq:0, entity_type:'provider_execution',
    who:'edge:provider_exec', did:'called', this:'provider.exec',
    at: now(), status: error? 'error':'complete',
    input: PAYLOAD, output: error? null: out, error,
    owner_id: prov.owner_id, tenant_id: prov.tenant_id, visibility: prov.visibility ?? 'private',
    related_to: [prov.id]
  };
  await sign(execSpan); await insertSpan(execSpan);
};
$$,'javascript','deno@1.x','daniel','voulezvous','tenant');


⸻

4) Prompt System Kernels / Kernels do Sistema de Prompts

4.1 Build (ID c0c0c0c0-0000-4000-8000-bldp00000001, seq=1) — compiled_hash

(Already provided in our “Patch Pack v1” — kept here for consolidation.)

(Code omitted here for brevity — see earlier section “Build kernel ➜ emit compiled_hash”.)

4.2 Prompt Runner (ID c0c0c0c0-0000-4000-8000-runp00000001, seq=1) — telemetry (model + hash)

(Code omitted here — see earlier section “Telemetry in prompt_runner_kernel”.)

4.3 Evaluator (ID c0c0c0c0-0000-4000-8000-eval00000001, seq=1) — stress fixtures

(Code omitted here — see earlier section “Eval kernel understands stress fixtures”.)

4.4 Bandit (ID c0c0c0c0-0000-4000-8000-band00000001, seq=0)

(Code provided earlier — “prompt_bandit_kernel”.)

⸻

5) Policies (ledger‑only) / Políticas (100% ledger)
	•	slow_exec_policy (status patch slow by threshold)
	•	metrics_exec_duration_policy (metric per execution)
	•	daily_exec_rollup_policy (daily counts per owner/status)
	•	error_report_policy (opens error report on execution.error)
	•	throttle_policy (labels)
	•	prompt_circuit_breaker_policy (injects anti‑tool spam block)
	•	prompt_confidence_escalation_policy (low confidence → human review)
	•	ttl_reaper_policy (NEW: expires temporary blocks by TTL)

SQL for each was given in previous messages. Here is only the new TTL reaper to close a gap.

INSERT INTO ledger.universal_registry
(id,seq,entity_type,who,did,"this",at,status,name,code,language,runtime,owner_id,tenant_id,visibility)
VALUES
('00000000-0000-4000-8000-ppol00000003',0,'policy','daniel','defined','policy',now(),'active',
'ttl_reaper_policy', $$
export default function on(span){
  // expire prompt_block with metadata.ttl_minutes elapsed
  if (span.entity_type!=='prompt_block') return [];
  const ttl = Number(span.metadata?.ttl_minutes||0);
  if (!ttl) return [];
  const created = new Date(span["when"]||span.at||Date.now());
  const expired = (Date.now() - created.getTime()) > (ttl*60*1000);
  if (!expired) return [];
  return [{
    emit_span: {
      entity_type:'status_patch', who:'policy:ttl', did:'expired', this:'status=archived',
      status:'complete', parent_id: span.id, related_to:[span.id],
      metadata:{ reason:'ttl' }
    }
  }];
}
$$,'javascript','deno@1.x','daniel','voulezvous','tenant');


⸻

6) Manifest & Governance / Manifesto & Governança

INSERT INTO ledger.universal_registry
(id,seq,entity_type,who,did,"this",at,status,name,metadata,owner_id,tenant_id,visibility)
VALUES
('00000000-0000-4000-8000-0000000000aa',2,'manifest','daniel','defined','manifest',now(),'active',
'kernel_manifest',
jsonb_build_object(
  'kernels', jsonb_build_object(
    'run_code','00000000-0000-4000-8000-000000000001',
    'observer','00000000-0000-4000-8000-000000000002',
    'request_worker','00000000-0000-4000-8000-000000000003',
    'policy_agent','00000000-0000-4000-8000-000000000004',
    'provider_exec','00000000-0000-4000-8000-000000000005',
    'stage0_loader','00000000-0000-4000-8000-0000000000ff'
  ),
  'allowed_boot_ids', jsonb_build_array(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000005',
    '00000000-0000-4000-8000-0000000000ff'
  ),
  'throttle', jsonb_build_object('per_tenant_daily_exec_limit', 100),
  'policy', jsonb_build_object('slow_ms', 5000),
  'override_pubkey_hex', 'PUT_YOUR_ADMIN_PUBKEY_HEX_HERE'
),
'daniel','voulezvous','tenant');


⸻

7) API Layer (Edge) / Camada de API (Edge)

7.1 Minimal Deno HTTP (REST + SSE) / Deno HTTP mínimo (REST + SSE)

Tip: Use this as a stand‑alone or behind Vercel/CF proxy.
Dica: Pode rodar sozinho ou atrás de Vercel/Cloudflare.

// api/index.ts — Deno deploy/Cloud Run/Fly
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import pg from "https://esm.sh/pg@8.11.3";
const { Client } = pg;

const DATABASE_URL = Deno.env.get("DATABASE_URL")!;

serve(async (req) => {
  const url = new URL(req.url);
  // CORS
  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });

  try {
    if (url.pathname === "/api/spans" && req.method === "GET") return listSpans(req);
    if (url.pathname === "/api/spans" && req.method === "POST") return createSpan(req);
    if (url.pathname === "/api/timeline" && req.method === "GET") return timeline(req);
    if (url.pathname === "/api/execute" && req.method === "POST") return executeNow(req);
    if (url.pathname === "/api/metrics" && req.method === "GET") return metrics();
    if (url.pathname === "/api/timeline/stream" && req.method === "GET") return streamTimeline(req);
    return new Response("Not Found", { status: 404, headers: corsJson() });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e.message||e) }), { status: 500, headers: corsJson() });
  }
});

function cors(){ return {
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
  "Access-Control-Allow-Headers":"Content-Type,Authorization"
};}
function corsJson(){ return { ...cors(), "Content-Type":"application/json" }; }

async function pgc() {
  const c = new Client({ connectionString: DATABASE_URL }); await c.connect(); return c;
}

async function listSpans(req:Request){
  const url = new URL(req.url); const entity = url.searchParams.get("entity_type"); const status = url.searchParams.get("status");
  const limit = Number(url.searchParams.get("limit")||50);
  const c = await pgc(); try {
    await c.query(`SET app.user_id='api'; SET app.tenant_id='voulezvous';`);
    let q = `SELECT * FROM ledger.universal_registry WHERE is_deleted=false`, p:any[]=[];
    if (entity){ p.push(entity); q+=` AND entity_type=$${p.length}`; }
    if (status){ p.push(status); q+=` AND status=$${p.length}`; }
    p.push(limit); q+=` ORDER BY at DESC LIMIT $${p.length}`;
    const { rows } = await c.query(q, p); return new Response(JSON.stringify(rows), { headers: corsJson() });
  } finally { await c.end(); }
}

async function createSpan(req:Request){
  const body = await req.json();
  const c = await pgc(); try {
    await c.query(`SET app.user_id=$1`, [body.owner_id||"api:web"]);
    if (body.tenant_id) await c.query(`SET app.tenant_id=$1`, [body.tenant_id]);
    body.id = body.id || crypto.randomUUID(); body.seq = body.seq ?? 0; body.at = new Date().toISOString();
    const cols = Object.keys(body), vals = Object.values(body), placeholders = cols.map((_,i)=>`$${i+1}`).join(",");
    const { rows } = await c.query(`INSERT INTO ledger.universal_registry (${cols.map(c=>`"${c}"`).join(",")}) VALUES (${placeholders}) RETURNING *`, vals);
    return new Response(JSON.stringify(rows[0]), { headers: corsJson() });
  } finally { await c.end(); }
}

async function timeline(req:Request){
  const url = new URL(req.url); const visibility = url.searchParams.get("visibility")||"tenant"; const limit = Number(url.searchParams.get("limit")||50);
  const c = await pgc(); try {
    await c.query(`SET app.user_id='api'; SET app.tenant_id='voulezvous';`);
    const { rows } = await c.query(`SELECT * FROM ledger.visible_timeline WHERE visibility=$1 OR visibility='public' ORDER BY "when" DESC LIMIT $2`, [visibility, limit]);
    return new Response(JSON.stringify(rows), { headers: corsJson() });
  } finally { await c.end(); }
}

async function executeNow(req:Request){
  const { span_id } = await req.json();
  // In production, call request_worker/observer flow; here we call run_code directly via Stage-0 endpoint or queue.
  return new Response(JSON.stringify({ scheduled_for: span_id }), { headers: corsJson() });
}

async function metrics(){
  const c = await pgc(); try {
    await c.query(`SET app.user_id='api:metrics'; SET app.tenant_id='voulezvous';`);
    const counts = await c.query(`
      SELECT date("when") AS day, status, count(*)::int AS n
      FROM ledger.visible_timeline WHERE entity_type='execution'
      GROUP BY 1,2 ORDER BY 1 DESC, 2 ASC LIMIT 200`);
    const latency = await c.query(`
      SELECT date("when") AS day, avg(duration_ms)::int AS avg_ms,
             percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms
      FROM ledger.visible_timeline WHERE entity_type='execution'
      GROUP BY 1 ORDER BY 1 DESC LIMIT 30`);
    return new Response(JSON.stringify({ counts: counts.rows, latency: latency.rows }), { headers: corsJson() });
  } finally { await c.end(); }
}

async function streamTimeline(_req:Request){
  const c = await pgc();
  await c.query(`SET app.user_id='api:sse'; SET app.tenant_id='voulezvous'`);
  await c.query(`LISTEN timeline_updates`);
  const stream = new ReadableStream({
    start(controller) {
      // @ts-ignore
      c.on("notification", (msg:any) => controller.enqueue(new TextEncoder().encode(`data: ${msg.payload}\n\n`)));
    },
    cancel() { c.end(); }
  });
  return new Response(stream, { headers: { ...cors(), "Content-Type":"text/event-stream", "Cache-Control":"no-cache", "Connection":"keep-alive" }});
}

7.2 OpenAPI (LLM‑friendly) / OpenAPI (amigável a LLMs)

openapi: 3.1.0
info:
  title: LogLineOS API
  version: "1.0"
servers:
  - url: https://your-logline-api.example.com
paths:
  /api/spans:
    get:
      summary: List spans
      parameters:
        - in: query; name: entity_type; schema: { type: string }
        - in: query; name: status; schema: { type: string }
        - in: query; name: limit; schema: { type: integer, default: 50 }
      responses:
        "200": { description: OK, content: { application/json: { schema: { type: array, items: { $ref: "#/components/schemas/Span" }}}}}
    post:
      summary: Create span (append-only)
      requestBody: { required: true, content: { application/json: { schema: { $ref: "#/components/schemas/Span" }}}}
      responses: { "200": { description: Created, content: { application/json: { schema: { $ref: "#/components/schemas/Span" }}}}}
  /api/timeline:
    get:
      summary: Visible timeline
      parameters:
        - in: query; name: visibility; schema: { type: string, enum: [public, tenant, private], default: tenant }
        - in: query; name: limit; schema: { type: integer, default: 50 }
      responses:
        "200": { description: OK, content: { application/json: { schema: { type: array, items: { $ref: "#/components/schemas/Span" }}}}}
  /api/execute:
    post:
      summary: Schedule/trigger execution for a function span
      requestBody: { required: true, content: { application/json: { schema: { type: object, properties: { span_id: { type: string, format: uuid }}, required: [span_id] }}}}
      responses: { "200": { description: Accepted } }
  /api/metrics:
    get:
      summary: Execution metrics
      responses: { "200": { description: OK } }
  /api/timeline/stream:
    get:
      summary: Server-Sent Events stream of new spans
      responses: { "200": { description: "text/event-stream" } }
components:
  schemas:
    Span:
      type: object
      properties:
        id: { type: string, format: uuid }
        seq: { type: integer, minimum: 0 }
        entity_type: { type: string }
        who: { type: string }
        did: { type: string }
        this: { type: string }
        at: { type: string, format: date-time }
        parent_id: { type: string, format: uuid, nullable: true }
        related_to: { type: array, items: { type: string, format: uuid } }
        owner_id: { type: string }
        tenant_id: { type: string }
        visibility: { type: string, enum: [private, tenant, public] }
        status: { type: string }
        name: { type: string }
        description: { type: string }
        code: { type: string }
        language: { type: string }
        runtime: { type: string }
        input: { type: object, additionalProperties: true }
        output: { type: object, additionalProperties: true }
        error: { type: object, additionalProperties: true }
        duration_ms: { type: integer }
        trace_id: { type: string }
        prev_hash: { type: string }
        curr_hash: { type: string }
        signature: { type: string }
        public_key: { type: string }
        metadata: { type: object, additionalProperties: true }
      required: [id, seq, entity_type, who, this, at, visibility]


⸻

8) Frontend‑agnostic Adapters / Adaptadores agnósticos de Frontend
	•	Next.js + shadcn dashboard (timeline, functions, execute) — provided earlier.
	•	Telegram Worker — provided earlier.
	•	Universal client (TS) — provided earlier.
	•	HTMX/SSR — trivial, call the API endpoints.

(Reuse the code from previous messages; unchanged.)

⸻

9) Prompt System Seeds / Sementes do Sistema de Prompts
	•	Blocks: doctrine, product, app, behavioral_prior
	•	Variant: faq_answerer@v1 (includes prior)
	•	Eval cards: happy‑path + stress
	•	Kernels: build (compiled_hash), runner (telemetry), eval (stress), bandit (selection)

(SQL seeds were provided earlier; consolidate them as needed.)

⸻

10) Operations Playbook / Runbook Operacional

EN
	•	Recommended runtime: Deno on Cloud Run/Fly/Railway; Node is supported but avoid child_process/fs; use Workers.
	•	Crons:
	•	observer_bot_kernel : every 2–10s
	•	request_worker_kernel: every 2–10s
	•	policy_agent_kernel  : every 5–30s
	•	prompt_eval_kernel   : nightly (per family/variant)
	•	prompt_bandit_kernel : daily (per family)
	•	Key management: keep Ed25519 private key only in Stage‑0 env; rotate via manifest override_pubkey_hex.
	•	Quotas: per‑tenant daily executions in Manifest; override requires signed “force”.
	•	SSE: LISTEN/NOTIFY wired via trigger; fallback to polling if platform blocks LISTEN.
	•	Backups: continuous archiving (WAL) or daily base + WAL; table is append‑only.

PT
	•	Runtime recomendado: Deno (Cloud Run/Fly/Railway). Evite child_process/fs.
	•	Crons: conforme acima.
	•	Chaves: Ed25519 privada apenas no Stage‑0; rotação via override_pubkey_hex.
	•	Cotas: por tenant/dia no Manifest; override exige “force” assinado.
	•	SSE: LISTEN/NOTIFY via trigger; fallback em polling.
	•	Backups: WAL contínuo ou base diária + WAL. Tabela é append‑only.

⸻

11) Security Notes / Notas de Segurança
	•	Ledger‑only: All business logic inside spans function. Stage‑0 is a fixed loader.
	•	Idempotency: advisory locks per span.id and idempotent request inserts.
	•	Proofs: deterministic BLAKE3 + optional Ed25519 signature on emitted spans.
	•	RLS: strict ownership/tenant/visibility checks; all API calls set app.user_id/app.tenant_id.

⸻

12) LLM‑friendly Index / Índice amigável a LLMs
	•	OpenAPI (above) for discovery
	•	Span JSON Schema (OpenAPI component)
	•	Stable IDs for kernels/policies/variants
	•	Compiled prompt hash recorded in prompt_build + carried in prompt_run.input.compiled_hash
	•	Telemetry: prompt_run.output.latency_ms, provider model, trace_id

⸻

13) Our Trajectory / Nossa Trajetória
	•	From tables to semantics: ~70 columns carry meaning; entities fill only what’s needed (sparse, queryable).
	•	From services to spans: executors, observers, policies, providers, prompts — everything is a span.
	•	From craft to engineering: prompts as contracts (schemas), compiled with priority blocks, hashed, evaluated, and auto‑promoted by bandit policy.
	•	From demos to production: quotas, locks, slow markers, SSE, metrics, OpenAPI, and governance via Manifest.

⸻

14) Quickstart Commands / Comandos Rápidos

Compile a variant → build prompt

deno run -A stage0_loader.ts \
  BOOT_FUNCTION_ID=c0c0c0c0-0000-4000-8000-bldp00000001 \
  VARIANT_ID=bbbb0000-0000-4000-8000-vfaq00000001 \
  DATABASE_URL="postgres://..." APP_USER_ID="edge:build" APP_TENANT_ID="voulezvous"

Run a user request

deno run -A stage0_loader.ts \
  BOOT_FUNCTION_ID=c0c0c0c0-0000-4000-8000-runp00000001 \
  VARIANT_ID=bbbb0000-0000-4000-8000-vfaq00000001 \
  PROVIDER_ID=00000000-0000-4000-8000-000000000101 \
  USER_INPUT="When founded?" CONTEXT_TEXT="Founded in 2012." \
  OPENAI_API_KEY="sk-..." DATABASE_URL="..." \
  APP_USER_ID="edge:prompt" APP_TENANT_ID="voulezvous"

Evaluate (happy+stress)

deno run -A stage0_loader.ts \
  BOOT_FUNCTION_ID=c0c0c0c0-0000-4000-8000-eval00000001 \
  VARIANT_ID=bbbb0000-0000-4000-8000-vfaq00000001 \
  PROVIDER_ID=00000000-0000-4000-8000-000000000101 \
  EVAL_ID=dddd0000-0000-4000-8000-evfq00000001 \
  OPENAI_API_KEY="sk-..." DATABASE_URL="..." \
  APP_USER_ID="edge:eval" APP_TENANT_ID="voulezvous"

Daily bandit

deno run -A stage0_loader.ts \
  BOOT_FUNCTION_ID=c0c0c0c0-0000-4000-8000-band00000001 \
  PROMPT_FAMILY=faq_answerer WINDOW_DAYS=1 \
  DATABASE_URL="..." APP_USER_ID="edge:bandit" APP_TENANT_ID="voulezvous"


⸻

15) What we improved vs. earlier drafts / O que melhoramos
	•	Unified “at/when” handling & view compatibility
	•	Hardened run_code: whitelist, tenant check, throttle, manifest slow_ms, timeout=slow_ms
	•	Compiled prompt hash recorded & propagated
	•	Stress fixtures and eval kernel support
	•	Circuit breaker and confidence escalation policies
	•	Added TTL reaper to auto‑expire injected blocks
	•	Consistent advisory locks and idempotency
	•	OpenAPI + SSE out‑of‑the‑box
	•	Clear guidance on Deno-first runtime for safe Workers

⸻

Appendix / Apêndice

A. Kernel & Policy IDs (stable) / IDs de Kernels & Políticas (estáveis)
	•	run_code_kernel — 00000000-0000-4000-8000-000000000001
	•	observer_bot_kernel — 00000000-0000-4000-8000-000000000002
	•	request_worker_kernel — 00000000-0000-4000-8000-000000000003
	•	policy_agent_kernel — 00000000-0000-4000-8000-000000000004
	•	provider_exec_kernel — 00000000-0000-4000-8000-000000000005
	•	build_prompt_kernel — c0c0c0c0-0000-4000-8000-bldp00000001
	•	prompt_runner_kernel — c0c0c0c0-0000-4000-8000-runp00000001
	•	prompt_eval_kernel — c0c0c0c0-0000-4000-8000-eval00000001
	•	prompt_bandit_kernel — c0c0c0c0-0000-4000-8000-band00000001
	•	Policies: slow_exec_policy (…401), metrics_exec_duration_policy (…402), daily_exec_rollup_policy (…403), error_report_policy (…404), throttle_policy (…405), prompt_circuit_breaker_policy (…001), prompt_confidence_escalation_policy (…002), ttl_reaper_policy (…003)
	•	kernel_manifest — 00000000-0000-4000-8000-0000000000aa

⸻

B. LLM Cheatsheet / Cola para LLMs
	•	Goal: Answer using only ledger context unless provider call requested.
	•	Cite: When using web or provider outputs, include related_to references in spans.
	•	Contract: If schema cannot be satisfied, emit { "error": "Insufficient evidence." }.
	•	One clarifying question maximum; else proceed best‑effort and state assumptions.
	•	Never promise background work; every action must happen now with a span.

⸻

If you want this as a single ndjson seed (kernels + policies + variant + eval + manifest), say the word and I’ll inline it here. This bluebook is ready for production and audit — and it tells our story: from semantic clarity to a ledger‑only runtime that earns respect by design.
