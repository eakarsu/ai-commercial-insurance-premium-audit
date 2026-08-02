UPDATE app_users
SET email='premium-audit-admin@example.com', name='Premium Audit Administrator'
WHERE role='admin' AND email='runtime-admin@example.com';

UPDATE user_notifications SET user_email='premium-audit-admin@example.com' WHERE user_email='runtime-admin@example.com';
UPDATE audit_documents SET received_by='premium-audit-admin@example.com' WHERE received_by='runtime-admin@example.com';
UPDATE reconciliation_runs SET created_by='premium-audit-admin@example.com' WHERE created_by='runtime-admin@example.com';
UPDATE premium_calculations SET created_by='premium-audit-admin@example.com' WHERE created_by='runtime-admin@example.com';
UPDATE premium_calculations SET reviewed_by='premium-audit-admin@example.com' WHERE reviewed_by='runtime-admin@example.com';
UPDATE calculation_approvals SET reviewer='premium-audit-admin@example.com' WHERE reviewer='runtime-admin@example.com';
UPDATE final_audit_packets SET issued_by='premium-audit-admin@example.com' WHERE issued_by='runtime-admin@example.com';
UPDATE dispute_messages SET sender='premium-audit-admin@example.com' WHERE sender='runtime-admin@example.com';
UPDATE dispute_messages SET recipient='premium-audit-admin@example.com' WHERE recipient='runtime-admin@example.com';
