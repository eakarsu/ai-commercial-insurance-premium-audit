# Premium Audit Intelligence

Exposure collection, classification validation, and defensible premium reconciliation.

Full React, Node/Express, PostgreSQL, and OpenRouter implementation with one governed evidence-to-issued-audit journey:

- source-document upload, content hashing, certification state, coverage checks, and evidence requests;
- deterministic payroll, sales, ledger, and tax reconciliation with retained exception arithmetic;
- versioned premium calculation using exposure, rate, experience and schedule modifiers, minimums, endorsements, and deposit premium;
- independent reviewer approval with creator/approver segregation;
- evidence-backed final audit packet generation;
- insured dispute correspondence and accountable notifications;
- append-only audit history and role-bound operations;
- allowlisted HTTPS connector configuration with a real live endpoint test;
- outcome analytics for evidence, variance, approvals, issued packets, and premium adjustment;
- 5 native business capabilities, 8 specialized AI workflows, 12 operational registers, and professional OpenRouter decision rendering.

## Configure and run

```bash
./start.sh
```

Open <http://127.0.0.1:4519>. `start.sh` automatically loads the protected portfolio-level `../.openrouter.env` file, then an optional app-local `.env` override. It creates the local PostgreSQL database when needed, runs migrations, preserves existing seeded data, starts the Node API on `5519`, and starts Vite on `4519`.

## Validate

```bash
node scripts/validate_app.mjs
node scripts/smoke_test.mjs
```

Both `.env` files are ignored. OpenRouter is called only from the backend; the API key is never sent to React.

For a live source-system connector, set `INTEGRATION_ALLOWED_HOSTS` to a comma-separated list of approved hostnames, then configure the HTTPS health/contract endpoint from **Source Systems**. An unconfigured or unreachable connector is never reported as connected.

The local pilot stores uploaded evidence in PostgreSQL with a 4 MB document limit. Production deployment should replace this with encrypted object storage, malware scanning, enterprise identity/SSO, and tenant-specific retention policies.
