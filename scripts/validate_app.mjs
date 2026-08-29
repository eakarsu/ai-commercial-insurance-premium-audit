import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const pg = require(path.join(root, 'backend', 'node_modules', 'pg'));
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const databaseUrl = process.env.DATABASE_URL || `postgresql://${os.userInfo().username}@127.0.0.1:5432/${app.dbName}`;

function assert(value, message) { if (!value) throw new Error(message); }

async function main() {
  assert(app.workflows.length === 8, 'expected 8 custom AI workflows');
  assert(app.operations.length === 12, 'expected 12 domain operational tables');
  assert(app.integrations.length >= 5, 'expected domain integrations');
  assert(app.domainProduct?.features?.length === 5, 'expected five native domain capabilities');
  assert(app.commercialExtension?.milestones?.length >= 4, 'commercial rollout milestones missing');
  assert(app.commercialExtension?.connectors?.length >= 3, 'commercial connector plan missing');
  assert(Object.values(app.commercialExtension?.defaults || {}).every(value => Number(value) >= 0), 'commercial scenario defaults invalid');
  assert(new Set(app.domainProduct.features.map(feature => feature.title)).size === 5, 'domain capability titles must be unique');
  for (const feature of app.domainProduct.features) {
    assert(feature.modules.length >= 2, `${feature.id} must combine multiple domain data sources`);
    assert(feature.actions.length >= 2, `${feature.id} must expose domain decisions`);
    assert(feature.modules.every(id => app.operations.some(module => module.id === id)), `${feature.id} references a missing PostgreSQL module`);
  }
  for (const workflow of app.workflows) {
    assert(workflow.fields.length >= 4, `${workflow.id} field schema is shallow`);
    assert(workflow.examples.length === 3, `${workflow.id} needs three fillers`);
    assert(workflow.aiActions.length === 3, `${workflow.id} needs three OpenRouter actions`);
    const keys = workflow.fields.map(field => field.key).sort().join(',');
    assert(workflow.examples.every(example => Object.keys(example.values).sort().join(',') === keys), `${workflow.id} filler misses fields`);
    assert(workflow.examples.every(example => Object.values(example.values).every(value => value !== '' && value !== null)), `${workflow.id} filler leaves optional input empty`);
  }
  for (const relative of ['frontend/src/App.jsx','frontend/src/main.jsx','frontend/vite.config.mjs','backend/server.mjs','backend/migrations/001_schema.sql','backend/migrations/002_audit_journey.sql','backend/scripts/seed.mjs']) assert(fs.existsSync(path.join(root, relative)), `missing ${relative}`);
  assert(!fs.existsSync(path.join(root, 'database.sqlite')), 'SQLite artifact must not exist');
  assert(!fs.existsSync(path.join(root, 'app.py')), 'Python application server must not exist');
  const frontend = fs.readFileSync(path.join(root, 'frontend/src/App.jsx'), 'utf8');
  const backend = fs.readFileSync(path.join(root, 'backend/server.mjs'), 'utf8');
  assert(frontend.includes("from 'react'"), 'frontend is not React');
  assert(frontend.includes('onClick={() => onOpen(item)}'), 'audit/queue click handler missing');
  assert(frontend.includes('OpenRouter'), 'provider status missing from React');
  assert(frontend.includes('function RichText'), 'professional AI narrative renderer missing');
  assert(frontend.includes('Provider assumption'), 'AI assumption callout missing');
  assert(frontend.includes('DomainCapability'), 'native domain capability UI missing');
  assert(frontend.includes('function CommercialExtension'), 'commercial extension UI missing');
  assert(frontend.includes("page==='commercial-extension'"), 'commercial extension navigation missing');
  assert(frontend.includes('Permitted {feature.title} actions'), 'domain decision controls missing');
  for (const component of ['EvidenceCenter','ReconciliationCenter','PremiumCenter','DisputeCenter','Notifications']) assert(frontend.includes(`function ${component}`), `${component} React surface missing`);
  assert(frontend.includes("id:'dashboard'"), 'journey dashboard navigation missing');
  assert(frontend.includes("id:'queue'"), 'workflow queue navigation missing');
  assert(backend.includes('/chat/completions'), 'OpenRouter backend request missing');
  assert(backend.includes('function extractJsonObject'), 'resilient OpenRouter JSON extraction missing');
  assert(!backend.includes("{ title: 'OpenRouter analysis'"), 'raw JSON fallback must not be rendered');
  assert(backend.includes('/api/domain/:featureId/actions/:actionId'), 'domain action API missing');
  assert(backend.includes('OPENROUTER_API_KEY'), 'OpenRouter credential boundary missing');
  assert(backend.includes("import pg from 'pg'"), 'PostgreSQL backend missing');
  for (const route of ['/api/evidence/documents','/api/reconciliations','/api/premium-calculations','/api/dispute-messages','/api/notifications']) assert(backend.includes(route), `backend journey route missing: ${route}`);
  assert(backend.includes('function premiumMath'), 'deterministic premium engine missing');
  assert(backend.includes('calculation creator cannot approve'), 'independent approval control missing');
  assert(backend.includes('Connector endpoints must use HTTPS'), 'real connector boundary missing');
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const tableRows = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    const tables = new Set(tableRows.rows.map(row => row.tablename));
    for (const required of ['app_users','workflow_cases','audit_events','saved_analyses','integration_state','audit_documents','evidence_requests','reconciliation_runs','premium_calculations','calculation_approvals','final_audit_packets','dispute_messages','user_notifications',...app.operations.map(module => module.table)]) assert(tables.has(required), `missing PostgreSQL table ${required}`);
    assert(Number((await pool.query('SELECT COUNT(*) count FROM app_users')).rows[0].count) === 3, 'demo users not seeded');
    assert(Number((await pool.query('SELECT COUNT(*) count FROM workflow_cases')).rows[0].count) === 120, 'workflow cases not seeded');
    let operationRows = 0;
    for (const module of app.operations) operationRows += Number((await pool.query(`SELECT COUNT(*) count FROM "${module.table}"`)).rows[0].count);
    assert(operationRows === 180, 'domain tables must contain 180 seeded rows');
    assert(Number((await pool.query('SELECT COUNT(*) count FROM audit_documents')).rows[0].count) === 30, 'audit evidence must contain 30 seeded documents');
    assert(Number((await pool.query('SELECT COUNT(*) count FROM reconciliation_runs')).rows[0].count) === 15, 'reconciliation runs must contain 15 seeded decisions');
    assert(Number((await pool.query('SELECT COUNT(*) count FROM premium_calculations')).rows[0].count) === 15, 'premium calculations must contain 15 seeded versions');
  } finally { await pool.end(); }
  console.log(`Validated ${app.id}: governed evidence-to-issued-audit journey, 5 native capabilities, React, PostgreSQL, independent approval, live connector controls, and OpenRouter`);
}

main().catch(error => { console.error(error.message); process.exit(1); });
