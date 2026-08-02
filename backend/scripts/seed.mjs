import 'dotenv/config';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const backendRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const projectRoot = path.dirname(backendRoot);
const config = JSON.parse(fs.readFileSync(path.join(projectRoot, 'app.json'), 'utf8'));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const owners = ['Avery Morgan', 'Jordan Lee', 'Taylor Brooks', 'Morgan Chen', 'Riley Patel'];
const risks = ['Low', 'Moderate', 'High', 'Critical'];
const regions = ['Northeast', 'Southeast', 'Midwest', 'Southwest', 'West'];

function identifier(value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error('Unsafe SQL identifier');
  return `"${value}"`;
}

function isoDate(offset) {
  const value = new Date(Date.UTC(2026, 7, 1 + offset));
  return value.toISOString().slice(0, 10);
}

function seedValue(field, index) {
  if (field.options?.length) return field.options[index % field.options.length];
  if (field.type === 'date') return isoDate(index * 3);
  if (field.type === 'number') return (index + 3) * 17;
  if (field.type === 'currency') return (index + 1) * 18750;
  if (field.type === 'textarea') return `Evidence package ${index + 1} with source validation, exception rationale, financial context, and reviewer notes.`;
  return `${field.label} ${String(index + 1).padStart(2, '0')}`;
}

async function seedAuditJourney(client) {
  const present = Number((await client.query('SELECT COUNT(*)::int count FROM audit_documents')).rows[0].count);
  if (present > 0) return;
  const auditReferences = Array.from({ length: 15 }, (_, index) => `OPS-01-${String(index + 1).padStart(3, '0')}`);
  const documentCategories = ['Policy','Payroll','General Ledger','Certificate of Insurance','Sales'];
  for (let index = 0; index < auditReferences.length; index += 1) {
    const auditReference = auditReferences[index];
    for (let documentIndex = 0; documentIndex < 2; documentIndex += 1) {
      const category = documentCategories[(index + documentIndex) % documentCategories.length];
      const fileName = `${auditReference.toLowerCase()}-${category.toLowerCase().replaceAll(' ','-')}.txt`;
      const extractedText = `${category} source evidence for ${auditReference}. Policy period 2025-01-01 through 2025-12-31. Certified totals and source lineage are available for reviewer validation.`;
      const sha256 = crypto.createHash('sha256').update(`${fileName}:${extractedText}`).digest('hex');
      await client.query(`INSERT INTO audit_documents(audit_reference,category,file_name,mime_type,file_size,sha256,source_system,period_start,period_end,certification_status,extraction_status,extracted_text,received_by)
        VALUES($1,$2,$3,'text/plain',$4,$5,$6,'2025-01-01','2025-12-31',$7,'Ready',$8,$9)`, [auditReference, category, fileName, extractedText.length, sha256, documentIndex ? 'Insured secure upload' : 'Policy administration', index % 3 === 0 ? 'Uncertified' : 'Certified', extractedText, owners[index % owners.length]]);
    }
    await client.query(`INSERT INTO evidence_requests(audit_reference,requested_from,document_type,due_date,status,request_message,owner,sent_at,completed_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [auditReference, `Controller ${index + 1}@insured.example`, documentCategories[(index + 2) % documentCategories.length], isoDate(index + 2), ['Draft','Sent','Received','Overdue'][index % 4], `Please provide certified ${documentCategories[(index + 2) % documentCategories.length]} support for ${auditReference}.`, owners[index % owners.length], index % 4 === 0 ? null : new Date(Date.UTC(2026, 6, 25 + index)), index % 4 === 2 ? new Date(Date.UTC(2026, 6, 28 + index)) : null]);
    const reported = 625000 + index * 42000;
    const audited = reported + (index % 2 === 0 ? 18500 + index * 750 : -(8500 + index * 300));
    const allowable = index % 3 === 0 ? 6500 : 2500;
    const unexplained = Math.abs(audited - reported) - allowable;
    const tolerance = 10000;
    const resultStatus = unexplained > 50000 ? 'Material exception' : unexplained > tolerance ? 'Exception' : 'Reconciled';
    await client.query(`INSERT INTO reconciliation_runs(audit_reference,source_type,reported_amount,audited_amount,allowable_adjustment,unexplained_variance,tolerance,result_status,calculation,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [auditReference, index % 2 ? 'Sales' : 'Payroll', reported, audited, allowable, unexplained, tolerance, resultStatus, { formula: 'abs(audited - reported) - allowable adjustment', variancePercent: Number(((unexplained / Math.max(reported, 1)) * 100).toFixed(2)) }, owners[index % owners.length]]);
    const rate = 3.25 + (index % 5) * 0.42;
    const experienceModifier = 0.86 + (index % 4) * 0.08;
    const scheduleModifier = 0.95 + (index % 3) * 0.05;
    const minimumPremium = 7500;
    const depositPremium = 22000 + index * 850;
    const endorsements = index % 3 === 0 ? 1250 : 0;
    const calculatedPremium = Math.max(minimumPremium, (audited / 100) * rate * experienceModifier * scheduleModifier + endorsements);
    const adjustment = calculatedPremium - depositPremium;
    const calculation = await client.query(`INSERT INTO premium_calculations(audit_reference,version,line_of_business,state,class_code,audited_exposure,rate,experience_modifier,schedule_modifier,minimum_premium,deposit_premium,endorsements,calculated_premium,adjustment,status,inputs,created_by,reviewed_by,approved_at)
      VALUES($1,1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`, [auditReference, index % 2 ? 'General Liability' : 'Workers Compensation', ['CA','NY','TX','IL','FL'][index % 5], ['8810','8742','5606','5645'][index % 4], audited, rate, experienceModifier, scheduleModifier, minimumPremium, depositPremium, endorsements, calculatedPremium.toFixed(2), adjustment.toFixed(2), ['Draft','Review','Approved','Issued'][index % 4], { basis: 'audited exposure per $100', sourceReconciliation: resultStatus }, owners[index % owners.length], index % 4 > 1 ? 'Independent Reviewer' : null, index % 4 > 1 ? new Date(Date.UTC(2026, 6, 26 + index)) : null]);
    if (index % 4 > 1) await client.query(`INSERT INTO calculation_approvals(calculation_id,step,decision,reviewer,reviewer_role,comment)
      VALUES($1,'Supervisor approval','Approved','Independent Reviewer','reviewer',$2)`, [calculation.rows[0].id, 'Verified exposure basis, rate version, modifiers, deposit premium, and supporting evidence.']);
    if (index % 4 === 3) {
      const packetNumber = `FAP-2026-${String(index + 1).padStart(4, '0')}`;
      const packetText = `FINAL PREMIUM AUDIT\nPacket ${packetNumber}\nAudit ${auditReference}\nCalculated premium: $${calculatedPremium.toFixed(2)}\nAdjustment: $${adjustment.toFixed(2)}\nIssued after independent supervisor approval.`;
      await client.query(`INSERT INTO final_audit_packets(calculation_id,packet_number,summary,packet_text,issued_by)
        VALUES($1,$2,$3,$4,'Premium Audit Administrator')`, [calculation.rows[0].id, packetNumber, { auditReference, calculatedPremium: calculatedPremium.toFixed(2), adjustment: adjustment.toFixed(2) }, packetText]);
    }
    await client.query(`INSERT INTO dispute_messages(dispute_reference,direction,channel,subject,body,sender,recipient)
      VALUES($1,$2,$3,$4,$5,$6,$7)`, [`OPS-07-${String(index + 1).padStart(3, '0')}`, index % 2 ? 'Inbound' : 'Outbound', index % 2 ? 'Portal' : 'Email', `Premium audit evidence ${auditReference}`, `Documented communication regarding the challenged exposure and classification for ${auditReference}.`, index % 2 ? 'Insured Controller' : owners[index % owners.length], index % 2 ? owners[index % owners.length] : 'Insured Controller']);
  }
  for (let index = 0; index < 12; index += 1) await client.query(`INSERT INTO user_notifications(user_email,severity,title,detail,related_type,related_reference)
    VALUES($1,$2,$3,$4,$5,$6)`, [['premium-audit-admin@example.com','operations-lead@example.com','reviewer@example.com'][index % 3], ['Info','Warning','Critical'][index % 3], ['Evidence received','Reconciliation exception','Approval required'][index % 3], `Premium audit journey item ${index + 1} requires an attributed review decision.`, ['Evidence','Reconciliation','Calculation'][index % 3], auditReferences[index]]);
}

async function main() {
  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT COUNT(*)::int count FROM app_users');
    if (existing.rows[0].count > 0 && process.env.SEED_FORCE !== '1') {
      await client.query('BEGIN');
      await seedAuditJourney(client);
      await client.query('COMMIT');
      console.log(`Seed already present for ${config.id}; preserving PostgreSQL data`);
      return;
    }
    await client.query('BEGIN');
    const operationTables = config.operations.map(module => identifier(module.table)).join(',');
    await client.query(`TRUNCATE final_audit_packets,calculation_approvals,premium_calculations,reconciliation_runs,evidence_requests,dispute_messages,audit_documents,user_notifications,${operationTables},workflow_cases,saved_analyses,audit_events,integration_state,app_users RESTART IDENTITY CASCADE`);
    const passwordHash = await bcrypt.hash(process.env.DEMO_PASSWORD || 'LocalDemo!2026', 12);
    for (const [email, name, role] of [
      ['premium-audit-admin@example.com', 'Premium Audit Administrator', 'admin'],
      ['operations-lead@example.com', 'Operations Lead', 'operator'],
      ['reviewer@example.com', 'Independent Reviewer', 'reviewer'],
    ]) await client.query('INSERT INTO app_users(email,name,role,password_hash) VALUES($1,$2,$3,$4)', [email, name, role, passwordHash]);
    for (let workflowIndex = 0; workflowIndex < config.workflows.length; workflowIndex += 1) {
      const workflow = config.workflows[workflowIndex];
      for (let index = 0; index < 15; index += 1) {
        const payload = Object.fromEntries(workflow.fields.map(field => [field.key, seedValue(field, index)]));
        await client.query('INSERT INTO workflow_cases(workflow_id,reference,subject,owner,state,risk,due_date,amount,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [workflow.id, `${config.id.slice(0,5).toUpperCase()}-${String(workflowIndex + 1).padStart(2,'0')}-${String(index + 1).padStart(3,'0')}`, `${workflow.title} — ${regions[index % regions.length]} case ${index + 1}`, owners[index % owners.length], ['intake','analyzing','review','approved','closed'][index % 5], risks[index % 4], isoDate(index * 3 + workflowIndex), (index + 1) * (workflowIndex + 2) * 2750, payload]);
      }
    }
    for (let moduleIndex = 0; moduleIndex < config.operations.length; moduleIndex += 1) {
      const module = config.operations[moduleIndex];
      const names = ['reference','status','owner','risk','due_date','amount',...module.columns.map(column => column.dbKey)];
      const quoted = names.map(identifier).join(',');
      const parameters = names.map((_, index) => `$${index + 1}`).join(',');
      for (let index = 0; index < 15; index += 1) {
        const values = [`OPS-${String(moduleIndex + 1).padStart(2,'0')}-${String(index + 1).padStart(3,'0')}`, ['Open','Investigating','Review','Approved','Closed'][index % 5], owners[index % owners.length], risks[index % 4], isoDate(index * 2 + moduleIndex + 4), (index + 2) * (moduleIndex + 1) * 4100, ...module.columns.map(column => seedValue(column, index))];
        await client.query(`INSERT INTO ${identifier(module.table)}(${quoted}) VALUES(${parameters})`, values);
      }
    }
    for (const integration of config.integrations) await client.query('INSERT INTO integration_state(id,name,category,mode,status) VALUES($1,$2,$3,$4,$5)', [integration.id, integration.name, integration.category, integration.mode, 'Configured']);
    for (let index = 0; index < 24; index += 1) await client.query('INSERT INTO audit_events(event_time,actor,action,object_type,object_reference,detail) VALUES($1,$2,$3,$4,$5,$6)', [new Date(Date.UTC(2026, 6, 23 + Math.floor(index / 8), 9 + index % 8, 15)), owners[index % owners.length], ['Reviewed','Assigned','Evidence attached','Status changed'][index % 4], ['AI workflow','Operational record','Control','Integration'][index % 4], `AUD-${String(index + 1).padStart(4,'0')}`, `Verified domain activity ${index + 1} with source evidence and reviewer attribution.`]);
    await seedAuditJourney(client);
    await client.query('COMMIT');
    console.log(`Seeded ${config.id}: 3 users, 120 workflow cases, 180 operational rows`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
