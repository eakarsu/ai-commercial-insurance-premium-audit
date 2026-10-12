const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const STATES = ['Open', 'Investigating', 'Review', 'Approved', 'Closed'];
const RISKS = ['Low', 'Moderate', 'High', 'Critical'];
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const readonly = definition => definition?.immutable || definition?.readOnly || definition?.readonly;

export function recordPermissions(user, policy = {}) {
  const role = user?.role;
  return {
    canEdit: Boolean(role && (policy.canEdit ? policy.canEdit(user) : ['admin', 'operator'].includes(role))),
    canDelete: Boolean(role && (policy.canDelete ? policy.canDelete(user) : role === 'admin')),
  };
}

function id(value) {
  const text = String(value ?? '');
  if (!/^[1-9]\d{0,18}$/.test(text) || BigInt(text) > 9223372036854775807n) fail(422, 'A valid record ID is required.');
  return text;
}
function recordVersion(value) {
  if (typeof value !== 'string' || !/^\d{1,10}$/.test(value)) fail(422, 'Open the record again before saving or deleting it.');
  return value;
}
function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function scalar(field, value) {
  if (value === undefined || value === null) fail(422, `${field.label || field.key} is required.`);
  if (field.type === 'number' || field.type === 'currency') {
    if (String(value).trim() === '') fail(422, `${field.label || field.key} must be a number.`);
    const number = Number(value);
    if (!Number.isFinite(number) || Math.abs(number) >= 1e14 || field.min !== undefined && number < field.min || field.max !== undefined && number > field.max) fail(422, `${field.label || field.key} is outside the allowed range.`);
    return number;
  }
  if (field.type === 'date') {
    const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`)) || new Date(`${text}T00:00:00Z`).toISOString().slice(0, 10) !== text) fail(422, `${field.label || field.key} must be a valid date.`);
    return text;
  }
  if (!['string', 'number', 'boolean'].includes(typeof value)) fail(422, `${field.label || field.key} must be a text value.`);
  const text = String(value).trim();
  if (field.required && !text || text.length > 4000) fail(422, `${field.label || field.key} is required and must fit within 4,000 characters.`);
  if (field.options && !field.options.map(option => typeof option === 'object' ? option.value : option).includes(text)) fail(422, `${field.label || field.key} has an invalid selection.`);
  return text;
}

/** Mounted after the app's native authentication; no audit or evidence table is exposed. */
export function mountOperationalRecordActions(app, { pool, config, identifier, audit, basePath = '/api', permissionPolicy = {} }) {
  const quote = name => {
    if (!IDENTIFIER.test(name)) fail(422, 'Invalid configured record field.');
    return identifier ? identifier(name) : `"${name}"`;
  };
  const commonOperation = [
    { key: 'status', options: STATES, required: true }, { key: 'owner', required: true },
    { key: 'risk', options: RISKS, required: true }, { key: 'due_date', type: 'date' }, { key: 'amount', type: 'number', min: 0 },
  ];
  const commonCase = [
    { key: 'subject', required: true }, { key: 'owner', required: true },
    { key: 'state', options: ['intake', 'analyzing', 'review', 'approved', 'closed'], required: true },
    { key: 'risk', options: RISKS, required: true }, { key: 'due_date', type: 'date' }, { key: 'amount', type: 'number', min: 0 },
  ];
  function definition(moduleId) {
    const module = (config.operations || []).find(item => item.id === moduleId);
    if (!module || !/^op_[A-Za-z0-9_]+$/.test(module.table)) fail(404, 'Unknown operational module.');
    return module;
  }
  async function actor(client, req) {
    if (!req.user?.id) fail(401, 'Authentication required.');
    const user = (await client.query('SELECT * FROM app_users WHERE id=$1', [id(req.user.id)])).rows[0];
    if (!user || user.active === false || user.is_active === false || user.disabled === true) fail(401, 'The signed-in account is no longer available.');
    return user;
  }
  function endpoint(kind, mutation) {
    return async (req, res) => {
      let client; let transaction = false;
      try {
        const module = kind === 'operation' ? definition(req.params.moduleId || req.body?.moduleId) : null;
        const table = module?.table || 'workflow_cases'; const recordId = id(req.params.id);
        client = await pool.connect();
        if (mutation) { await client.query('BEGIN'); transaction = true; }
        const user = await actor(client, req); const permissions = recordPermissions(user, permissionPolicy);
        if (mutation && !(mutation === 'delete' ? permissions.canDelete : permissions.canEdit)) fail(403, 'Your role does not permit this record action.');
        if (mutation && readonly(module)) fail(403, 'This operational module is read-only.');
        const saved = await client.query(`SELECT record.*, record.xmin::text AS record_version FROM ${quote(table)} AS record WHERE id=$1${mutation ? ' FOR UPDATE' : ''}`, [recordId]);
        if (!saved.rowCount) fail(404, 'Record not found.');
        const current = saved.rows[0];
        const workflow = kind === 'case' ? (config.workflows || []).find(item => item.id === current.workflow_id) : null;
        if (kind === 'case' && !workflow) fail(404, 'The record does not belong to a configured workflow.');
        if (mutation && readonly(workflow)) fail(403, 'This workflow is read-only.');
        if (!mutation) return res.json({ item: current, permissions: readonly(module) || readonly(workflow) ? { canEdit: false, canDelete: false } : permissions });
        if (recordVersion(req.body?.recordVersion) !== current.record_version) fail(409, 'This record changed after you opened it. Reopen it before saving or deleting.');
        const title = module?.title || workflow.title;
        if (mutation === 'delete') {
          await client.query(`DELETE FROM ${quote(table)} WHERE id=$1`, [recordId]);
          await audit(client, user.email, 'Record deleted', title, current.reference, 'Record deleted through the confirmed record dialog.');
          await client.query('COMMIT'); transaction = false;
          return res.json({ message: 'Record deleted', deleted: true, id: recordId });
        }
        const supplied = req.body?.values;
        if (!object(supplied) || !Object.keys(supplied).length) fail(422, 'Editable record values are required.');
        const fields = kind === 'operation' ? [...commonOperation, ...module.columns.map(column => ({ ...column, key: column.dbKey }))] : commonCase;
        const allowed = new Set(fields.map(field => field.key)); if (kind === 'case') allowed.add('payload');
        if (Object.keys(supplied).some(key => !allowed.has(key))) fail(422, 'The request contains an immutable or unknown field.');
        const columns = []; const values = [];
        for (const field of fields) if (Object.hasOwn(supplied, field.key)) { columns.push(field.key); values.push(scalar(field, supplied[field.key])); }
        if (Object.hasOwn(supplied, 'payload')) {
          if (!object(supplied.payload)) fail(422, 'Workflow inputs must be an object.');
          const allowedInputs = new Set(workflow.fields.map(field => field.key));
          if (Object.keys(supplied.payload).some(key => !allowedInputs.has(key))) fail(422, 'Unknown workflow input field.');
          const payload = { ...current.payload };
          for (const field of workflow.fields) if (Object.hasOwn(supplied.payload, field.key)) payload[field.key] = scalar(field, supplied.payload[field.key]);
          columns.push('payload'); values.push(JSON.stringify(payload));
        }
        const assignments = columns.map((name, index) => `${quote(name)}=$${index + 1}`).join(',');
        const updated = await client.query(`UPDATE ${quote(table)} SET ${assignments} WHERE id=$${values.length + 1} RETURNING *, xmin::text AS record_version`, [...values, recordId]);
        await audit(client, user.email, 'Record edited', title, current.reference, `Updated fields: ${columns.join(', ')}.`);
        await client.query('COMMIT'); transaction = false;
        return res.json({ item: updated.rows[0], message: 'Record updated' });
      } catch (error) {
        if (transaction) await client.query('ROLLBACK').catch(() => {});
        if (res.headersSent) return;
        const status = error.status || (['23505', '23503'].includes(error.code) ? 409 : /^22|^23502/.test(error.code || '') ? 422 : 503);
        res.status(status).json({ error: error.status ? error.message : status === 409 ? 'The record conflicts with another saved record or retained evidence.' : status === 422 ? 'The supplied fields could not be saved. Check their values.' : 'The record action could not be completed. Try again.' });
      } finally { client?.release(); }
    };
  }
  app.get(`${basePath}/operation-records/:moduleId/:id`, endpoint('operation'));
  app.get(`${basePath}/records/:id`, endpoint('case'));
  app.put(`${basePath}/operation-records/:id`, endpoint('operation', 'update'));
  app.delete(`${basePath}/operation-records/:id`, endpoint('operation', 'delete'));
  app.put(`${basePath}/records/:id`, endpoint('case', 'update'));
  app.delete(`${basePath}/records/:id`, endpoint('case', 'delete'));
}
