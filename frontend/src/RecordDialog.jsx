import React, { useEffect, useMemo, useRef, useState } from 'react';

const titleCase = (key) => String(key).replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
const RISK = ['Low', 'Moderate', 'High', 'Critical'];
const baseFields = (kind) => [
  ...(kind === 'case' ? [{ key: 'subject', label: 'Subject', required: true }] : []),
  { key: kind === 'case' ? 'state' : 'status', label: 'Status', type: 'select', required: true, options: kind === 'case' ? ['intake', 'analyzing', 'review', 'approved', 'closed'] : ['Open', 'Investigating', 'Review', 'Approved', 'Closed'] },
  { key: 'owner', label: 'Owner', required: true },
  { key: 'risk', label: 'Risk', type: 'select', options: RISK, required: true },
  { key: 'due_date', label: 'Due date', type: 'date', required: true },
  { key: 'amount', label: 'Amount', type: 'number', step: 'any', min: 0, required: true },
];

function RecordValue({ value }) {
  if (value === null || value === undefined || value === '') return <span className="muted">Not provided</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (Array.isArray(value)) return <ul>{value.map((item, index) => <li key={index}><RecordValue value={item}/></li>)}</ul>;
  if (typeof value === 'object') return <dl>{Object.entries(value).map(([key, item]) => <div key={key}><dt>{titleCase(key)}</dt><dd><RecordValue value={item}/></dd></div>)}</dl>;
  return <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{String(value)}</span>;
}

export default function RecordDialog({ title, module, workflow, kind = 'operation', item, request, onClose, onChanged, children }) {
  const [record, setRecord] = useState(item);
  const [draft, setDraft] = useState({ ...item });
  const [permissions, setPermissions] = useState(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [needsReload, setNeedsReload] = useState(false);
  const dialog = useRef(null);
  const reading = useRef(null);
  const alive = useRef(true);
  const close = useRef(onClose); close.current = onClose;
  const writing = useRef(busy); writing.current = busy;
  const fields = useMemo(() => [...baseFields(kind), ...(kind === 'case' ? (workflow?.fields || []).map((field) => ({ ...field, type: field.type === 'currency' ? 'number' : field.type, payload: true })) : (module?.columns || []).map((field) => ({ ...field, type: field.type === 'currency' ? 'number' : field.type, key: field.dbKey })))], [kind, module, workflow]);
  const detailPath = kind === 'case' ? `/api/records/${item.id}` : `/api/operation-records/${encodeURIComponent(module.id)}/${item.id}`;
  const mutationPath = kind === 'case' ? `/api/records/${item.id}` : `/api/operation-records/${item.id}`;

  async function load() {
    reading.current?.abort(); const controller = new AbortController(); reading.current = controller;
    setLoading(true); setError(''); setNeedsReload(false);
    try {
      const result = await request(detailPath, { signal: controller.signal });
      if (!alive.current || controller.signal.aborted) return;
      setRecord(result.item); setDraft({ ...result.item }); setPermissions(result.permissions); setEditing(false); setConfirmDelete(false);
    } catch (failure) { if (alive.current && !controller.signal.aborted) setError(failure.message || 'The saved record could not be loaded.'); }
    finally { if (alive.current && !controller.signal.aborted) setLoading(false); }
  }
  useEffect(() => { alive.current = true; load(); return () => { alive.current = false; reading.current?.abort(); }; }, [detailPath]); // eslint-disable-line
  useEffect(() => {
    const previous = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; dialog.current?.querySelector('button')?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape' && !writing.current) { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const controls = [...(dialog.current?.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]') || [])];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, []);

  function valueFor(field) { return field.payload ? draft.payload?.[field.key] : draft[field.key]; }
  function update(field, value) { setDraft((current) => field.payload ? { ...current, payload: { ...current.payload, [field.key]: value } } : { ...current, [field.key]: value }); }
  async function mutate(method) {
    setBusy(true); setError('');
    try {
      const values = Object.fromEntries(fields.filter((field) => !field.payload).map((field) => [field.key, valueFor(field)]));
      if (kind === 'case') values.payload = Object.fromEntries(fields.filter((field) => field.payload && valueFor(field) !== undefined).map((field) => [field.key, valueFor(field)]));
      const result = await request(mutationPath, { method, body: JSON.stringify({ ...(kind === 'operation' ? { moduleId: module.id } : {}), recordVersion: record.record_version, ...(method === 'PUT' ? { values } : {}) }) });
      if (alive.current) await onChanged(result.message || (method === 'PUT' ? 'Record updated' : 'Record deleted'));
    } catch (failure) { if (alive.current) { setError(failure.message || 'The record action could not be completed.'); setNeedsReload(failure.status === 409); setConfirmDelete(false); } }
    finally { if (alive.current) setBusy(false); }
  }
  async function save(event) { event.preventDefault(); if (editing && permissions?.canEdit && !busy) await mutate('PUT'); }

  return <div className="modalBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className="modal recordEditor" ref={dialog} role="dialog" aria-modal="true" aria-label={title}>
      <header><div><span className="eyebrow">{editing ? 'Edit record' : 'Record details'}</span><h3>{title}</h3></div><button type="button" className="ghost" disabled={busy} aria-label="Cancel record dialog" onClick={onClose}>×</button></header>
      <form onSubmit={save} className="modalBody">
        {loading && <p className="muted" role="status">Loading the current saved record…</p>}
        {editing ? <div className="formGrid">{fields.map((field) => {
          const value = valueFor(field) ?? '';
          return <label className={field.type === 'textarea' ? 'full' : ''} key={`${field.payload ? 'payload:' : ''}${field.key}`}><span>{field.label || titleCase(field.key)}{field.required ? ' *' : ''}</span>{field.type === 'select' ? <select className="input" required={field.required} disabled={busy} value={value} onChange={(event) => update(field, event.target.value)}><option value="">Select…</option>{(field.options || []).map((option) => <option key={typeof option === 'object' ? option.value : option} value={typeof option === 'object' ? option.value : option}>{typeof option === 'object' ? option.label : option}</option>)}</select> : field.type === 'textarea' ? <textarea className="input" required={field.required} disabled={busy} rows={4} value={value} onChange={(event) => update(field, event.target.value)}/> : <input className="input" type={field.type || 'text'} required={field.required} disabled={busy} step={field.step || (field.type === 'number' ? 'any' : undefined)} min={field.min} max={field.max} value={field.type === 'date' ? String(value).slice(0, 10) : value} onChange={(event) => update(field, event.target.value)}/>}</label>;
        })}</div> : <><p className="muted">{module?.description}</p><div className="detailGrid">{Object.entries(record).filter(([key]) => key !== 'record_version').map(([key, value]) => <div className="detail" key={key}><small>{titleCase(key)}</small><RecordValue value={value}/></div>)}</div>{permissions?.canEdit && !loading && !busy && children}</>}
        {error && <div className="error" role="alert">{error}{(needsReload || !permissions) && <button type="button" className="secondary" disabled={busy} onClick={load}>Reload saved record</button>}</div>}
        {!loading && permissions && !permissions.canEdit && !permissions.canDelete && <p className="muted">Your role can view this record.</p>}
        {confirmDelete && <div className="deleteConfirm" role="alert"><strong>Delete {record.reference || title}?</strong><p>The audit trail will retain this action.</p><div className="buttonRow"><button type="button" className="danger" disabled={busy} onClick={() => permissions?.canDelete && mutate('DELETE')}>Delete record</button><button type="button" className="secondary" disabled={busy} onClick={() => setConfirmDelete(false)}>Cancel deletion</button></div></div>}
        <div className="buttonRow recordEditorActions">
          {permissions?.canEdit && (editing ? <button type="submit" className="primary" disabled={busy || loading || needsReload}>{busy ? 'Saving…' : 'Save changes'}</button> : <button type="button" className="primary" disabled={busy || loading} onClick={() => { setDraft({ ...record }); setEditing(true); setConfirmDelete(false); }}>Edit</button>)}
          {permissions?.canDelete && !editing && <button type="button" className="danger" disabled={busy || loading || needsReload} onClick={() => setConfirmDelete(true)}>Delete</button>}
          <button type="button" className="secondary" disabled={busy} onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  </div>;
}
