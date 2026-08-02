import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const apiPort = Number(process.env.SMOKE_API_PORT || app.apiPort + 1000);
const mockPort = apiPort + 1000;
const databaseUrl = process.env.DATABASE_URL || `postgresql://${os.userInfo().username}@127.0.0.1:5432/${app.dbName}`;
const env = { ...process.env, NODE_ENV: 'test', API_PORT: String(apiPort), UI_PORT: String(app.port), DATABASE_URL: databaseUrl, SESSION_SECRET: 'smoke-test-session-secret-at-least-32-chars', OPENROUTER_API_KEY: 'test-key-not-real', OPENROUTER_MODEL: 'anthropic/claude-haiku-4.5', OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1', OPENROUTER_TEST_URL: `http://127.0.0.1:${mockPort}/chat/completions`, CONNECTOR_TEST_ALLOW_HTTP: '1', INTEGRATION_ALLOWED_HOSTS: '127.0.0.1' };

function assert(value, message) { if (!value) throw new Error(message); }
async function request(route, token, options = {}) {
  const response = await fetch(`http://127.0.0.1:${apiPort}${route}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || `HTTP ${response.status}`), { status: response.status });
  return data;
}

const mock = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/connector/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', schema: req.headers['x-premium-audit-schema'] }));
    return;
  }
  let raw = ''; req.on('data', chunk => { raw += chunk; }); req.on('end', () => {
    const body = JSON.parse(raw || '{}');
    assert(req.headers.authorization === 'Bearer test-key-not-real', 'OpenRouter bearer header missing');
    assert(body.model === 'anthropic/claude-haiku-4.5', 'OpenRouter model missing');
    assert(Array.isArray(body.messages) && body.messages.length === 2, 'OpenRouter messages malformed');
    const structured = JSON.stringify({ headline: 'Provider-backed domain decision brief', executiveSummary: 'OpenRouter evaluated the specialized workflow inputs and prepared an auditable decision summary.', risk: 'HIGH — source evidence needs review', confidence: '91%', metrics: [{ label: 'Provider', value: 'OpenRouter' }], sections: [{ title: 'Domain conclusion', detail: 'Validate the material exception against source evidence.\n• Confirm source lineage\n• Retain reviewer approval' }, { title: 'Financial impact', detail: 'Prioritize the highest represented value.' }, { title: 'Control evidence', detail: 'Retain reviewer approval and source lineage.' }], actions: ['Assign owner', 'Validate evidence', 'Record decision'] });
    const content = `\`\`\`json\n${structured}\n\`\`\`\n**Assumption:** Demonstration inputs require professional source validation.`;
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ id: 'mock-openrouter-receipt', model: body.model, choices: [{ message: { content } }], usage: { prompt_tokens: 120, completion_tokens: 90, total_tokens: 210 } }));
  });
});

let backend;
try {
  const provision = spawnSync('bash', ['scripts/provision_database.sh'], { cwd: root, env, encoding: 'utf8' });
  if (provision.status !== 0) throw new Error(provision.stderr || 'PostgreSQL provisioning failed');
  await new Promise(resolve => mock.listen(mockPort, '127.0.0.1', resolve));
  backend = spawn('node', ['backend/server.mjs'], { cwd: root, env, stdio: ['ignore','ignore','pipe'] });
  for (let attempt = 0; attempt < 60; attempt += 1) { try { await request('/api/health'); break; } catch { if (attempt === 59) throw new Error('backend did not become ready'); await new Promise(resolve => setTimeout(resolve, 100)); } }
  const credentials = await request('/api/auth/demo-credentials');
  const login = await request('/api/auth/login', null, { method: 'POST', body: JSON.stringify(credentials) });
  const token = login.token;
  const reviewer = await request('/api/auth/login', null, { method: 'POST', body: JSON.stringify({ email: 'reviewer@example.com', password: credentials.password }) });
  const operator = await request('/api/auth/login', null, { method: 'POST', body: JSON.stringify({ email: 'operations-lead@example.com', password: credentials.password }) });
  const product = await request('/api/app', token); assert(product.ai.configured && product.ai.provider === 'openrouter', 'OpenRouter status is not configured');
  const dashboard = await request('/api/dashboard', token); assert(dashboard.workflowCount === 8 && dashboard.operationalTableCount === 12 && dashboard.recordCount + dashboard.operationalRowCount === 300, 'dashboard counts wrong');
  const domain = await request('/api/domain', token); assert(domain.features.length === 5, 'native domain capabilities missing');
  for (const feature of domain.features) {
    const capability = await request(`/api/domain/${feature.id}`, token);
    assert(capability.groups.length >= 2 && capability.groups.every(group => group.items.length === 15), `${feature.id} domain records missing`);
    const target = capability.groups[0]; const action = capability.feature.actions[0];
    const result = await request(`/api/domain/${feature.id}/actions/${action.id}`, token, { method: 'POST', body: JSON.stringify({ moduleId: target.module.id, recordId: target.items[0].id }) });
    assert(result.status === action.nextStatus && result.auditDetail === action.auditDetail, `${feature.id} domain action failed`);
  }
  const workflow = product.workflows[0]; assert(workflow.examples.length === 3, 'AI fillers missing');
  for (const analysisType of ['assess','evidence','plan']) { const result = await request('/api/ai/analyze', token, { method: 'POST', body: JSON.stringify({ workflowId: workflow.id, analysisType, inputs: workflow.examples[1].values }) }); assert(result.provider === 'openrouter' && result.sections.length >= 3, `OpenRouter ${analysisType} failed`); assert(result.risk === 'High' && result.confidence === 91, 'verbose risk/confidence normalization failed'); assert(result.providerNote === 'Demonstration inputs require professional source validation.', 'trailing provider assumption was not extracted'); assert(!result.sections.some(section => section.detail.includes('{\"headline\"')), 'raw JSON leaked into professional result'); }
  const operations = await request('/api/operations', token); assert(operations.items.length === 12, 'domain tables missing');
  for (const module of operations.items) { const rows = await request(`/api/operation-records?module=${module.id}`, token); assert(rows.items.length === 15, `${module.id} rows missing`); }
  const records = await request('/api/records', token); await request('/api/records/transition', token, { method: 'POST', body: JSON.stringify({ id: records.items[0].id, state: 'review' }) });
  const firstModule = operations.items[0]; const firstRows = await request(`/api/operation-records?module=${firstModule.id}`, token); await request('/api/operation-records/transition', token, { method: 'POST', body: JSON.stringify({ moduleId: firstModule.id, id: firstRows.items[0].id, state: 'Review' }) });
  assert((await request('/api/reports', token)).modules.length === 12, 'report drill-down data missing');
  assert((await request('/api/audit-events', token)).items.length >= 24, 'audit data missing');
  const evidence = await request('/api/evidence/documents', token); assert(evidence.items.length >= 30, 'seeded evidence missing');
  await request('/api/evidence/documents', token, { method: 'POST', body: JSON.stringify({ auditReference: 'SMOKE-AUDIT-001', category: 'Policy', fileName: 'smoke-policy.txt', mimeType: 'text/plain', sourceSystem: 'Smoke harness', periodStart: '2025-01-01', periodEnd: '2025-12-31', certificationStatus: 'Certified', extractedText: 'Certified policy source evidence for smoke validation.', contentBase64: Buffer.from('smoke-policy-content').toString('base64') }) });
  const coverage = await request('/api/evidence/coverage?auditReference=SMOKE-AUDIT-001', token); assert(coverage.coverage.find(item => item.category === 'Policy').status === 'Complete', 'evidence coverage wrong');
  await request('/api/evidence/requests', token, { method: 'POST', body: JSON.stringify({ auditReference: 'SMOKE-AUDIT-001', requestedFrom: 'controller@example.com', documentType: 'Payroll', dueDate: '2026-08-15', requestMessage: 'Provide certified payroll detail for the complete audit period.' }) });
  const reconciliation = await request('/api/reconciliations', token, { method: 'POST', body: JSON.stringify({ auditReference: 'SMOKE-AUDIT-001', sourceType: 'Payroll', reportedAmount: 500000, auditedAmount: 575000, allowableAdjustment: 5000, tolerance: 10000 }) });
  assert(reconciliation.item.result_status === 'Material exception' && Number(reconciliation.item.unexplained_variance) === 70000, 'deterministic reconciliation wrong');
  const calculation = await request('/api/premium-calculations', operator.token, { method: 'POST', body: JSON.stringify({ auditReference: 'SMOKE-AUDIT-001', lineOfBusiness: 'Workers Compensation', state: 'CA', classCode: '8810', auditedExposure: 575000, rate: 3.5, experienceModifier: 0.9, scheduleModifier: 1, minimumPremium: 5000, depositPremium: 10000, endorsements: 500, rateSource: 'Smoke filed rate', rateEffectiveDate: '2025-01-01' }) });
  assert(calculation.item.status === 'Review' && Number(calculation.item.calculated_premium) === 18612.5, 'premium calculation wrong');
  let segregationBlocked = false; try { await request(`/api/premium-calculations/${calculation.item.id}/approve`, operator.token, { method: 'POST', body: JSON.stringify({ decision: 'Approved', comment: 'Operator should not be permitted to approve this calculation.' }) }); } catch (error) { segregationBlocked = error.status === 403; } assert(segregationBlocked, 'operator approval was not blocked');
  await request(`/api/premium-calculations/${calculation.item.id}/approve`, reviewer.token, { method: 'POST', body: JSON.stringify({ decision: 'Approved', comment: 'Verified filed rate, source exposure, modifiers, deposit premium, and retained policy evidence.' }) });
  const packet = await request(`/api/premium-calculations/${calculation.item.id}/issue`, reviewer.token, { method: 'POST' }); assert(packet.item.packet_text.includes('FINAL PREMIUM AUDIT') && packet.item.packet_text.includes('SHA-256'), 'final audit packet incomplete');
  await request('/api/dispute-messages', token, { method: 'POST', body: JSON.stringify({ disputeReference: 'SMOKE-DISPUTE-001', direction: 'Outbound', channel: 'Portal', subject: 'Calculation response', body: 'The versioned calculation and evidence lineage are available for insured review.', recipient: 'controller@example.com' }) });
  assert((await request('/api/notifications', reviewer.token)).items.length > 0, 'review notifications missing');
  const integrations = await request('/api/integrations', token); const integration = integrations.items[0];
  await request(`/api/integrations/${integration.id}/configure`, token, { method: 'POST', body: JSON.stringify({ endpointUrl: `http://127.0.0.1:${mockPort}/connector/health`, authMode: 'Test', schemaName: 'premium-audit-v1' }) });
  const connection = await request('/api/integrations/test', token, { method: 'POST', body: JSON.stringify({ id: integration.id }) }); assert(connection.status === 'Connected' && connection.receipt.schema === 'premium-audit-v1', 'live connector test failed');
  const reports = await request('/api/reports', token); assert(reports.journey.documents >= 31 && reports.journey.issued_packets >= 1, 'journey analytics missing');
  console.log(`Smoke passed ${app.id}: evidence, deterministic reconciliation, versioned premium, independent approval, final packet, disputes, notifications, live connector, AI, reports, and audit`);
} finally {
  if (backend) { backend.kill('SIGTERM'); await new Promise(resolve => backend.once('exit', resolve)); }
  await new Promise(resolve => mock.close(resolve));
  spawnSync('node', ['backend/scripts/seed.mjs'], { cwd: root, env: { ...env, SEED_FORCE: '1' }, stdio: 'ignore' });
}
