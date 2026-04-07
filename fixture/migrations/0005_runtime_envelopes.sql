CREATE TABLE IF NOT EXISTS runtime_records (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	record_type TEXT NOT NULL,
	record_key TEXT NOT NULL,
	lookup_key TEXT,
	secondary_key TEXT,
	status TEXT NOT NULL,
	schema_version INTEGER NOT NULL DEFAULT 1,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	payload_json TEXT NOT NULL,
	meta_json TEXT NOT NULL DEFAULT '{}',
	UNIQUE(record_type, record_key)
);

CREATE INDEX IF NOT EXISTS idx_runtime_records_type_lookup
	ON runtime_records(record_type, lookup_key);
CREATE INDEX IF NOT EXISTS idx_runtime_records_type_status_updated
	ON runtime_records(record_type, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_runtime_records_type_secondary
	ON runtime_records(record_type, secondary_key);

CREATE TABLE IF NOT EXISTS message_queue (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	message_type TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'pending',
	schema_version INTEGER NOT NULL DEFAULT 1,
	related_model TEXT,
	related_id TEXT,
	priority INTEGER NOT NULL DEFAULT 0,
	available_at TEXT NOT NULL,
	claimed_by TEXT,
	claimed_at TEXT,
	lease_expires_at TEXT,
	attempts INTEGER NOT NULL DEFAULT 0,
	max_attempts INTEGER NOT NULL DEFAULT 3,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	payload_json TEXT NOT NULL,
	meta_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_message_queue_type_status_priority_available
	ON message_queue(message_type, status, priority DESC, available_at ASC);
CREATE INDEX IF NOT EXISTS idx_message_queue_claimed_by_lease
	ON message_queue(claimed_by, lease_expires_at);
CREATE INDEX IF NOT EXISTS idx_message_queue_updated_at
	ON message_queue(updated_at);

CREATE TABLE IF NOT EXISTS cursor_state (
	agent_slug TEXT NOT NULL,
	cursor_key TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'active',
	schema_version INTEGER NOT NULL DEFAULT 1,
	updated_at TEXT NOT NULL,
	payload_json TEXT NOT NULL,
	meta_json TEXT NOT NULL DEFAULT '{}',
	PRIMARY KEY (agent_slug, cursor_key)
);

CREATE INDEX IF NOT EXISTS idx_cursor_state_updated_at
	ON cursor_state(updated_at DESC);

CREATE TABLE IF NOT EXISTS lease_state (
	model TEXT NOT NULL,
	item_key TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'claimed',
	schema_version INTEGER NOT NULL DEFAULT 1,
	claimed_by TEXT,
	claimed_at TEXT,
	lease_expires_at TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	payload_json TEXT NOT NULL,
	meta_json TEXT NOT NULL DEFAULT '{}',
	PRIMARY KEY (model, item_key)
);

CREATE INDEX IF NOT EXISTS idx_lease_state_lookup
	ON lease_state(model, item_key, lease_expires_at);

INSERT OR IGNORE INTO runtime_records (
	record_type,
	record_key,
	lookup_key,
	secondary_key,
	status,
	schema_version,
	created_at,
	updated_at,
	payload_json,
	meta_json
)
SELECT
	'subscription',
	email,
	email,
	NULL,
	status,
	1,
	created_at,
	updated_at,
	json_object(
		'email', email,
		'name', name,
		'source', source,
		'consentAt', consent_at,
		'ipHash', ip_hash
	),
	json_object('legacyId', id)
FROM subscriptions;

INSERT OR IGNORE INTO runtime_records (
	record_type,
	record_key,
	lookup_key,
	secondary_key,
	status,
	schema_version,
	created_at,
	updated_at,
	payload_json,
	meta_json
)
SELECT
	'contact_submission',
	CAST(id AS TEXT),
	email,
	contact_type,
	'received',
	1,
	created_at,
	created_at,
	json_object(
		'name', name,
		'email', email,
		'organization', organization,
		'contactType', contact_type,
		'subject', subject,
		'message', message,
		'userAgent', user_agent,
		'ipHash', ip_hash
	),
	json('{}')
FROM contact_submissions;

INSERT OR IGNORE INTO runtime_records (
	record_type,
	record_key,
	lookup_key,
	secondary_key,
	status,
	schema_version,
	created_at,
	updated_at,
	payload_json,
	meta_json
)
SELECT
	'agent_run',
	run_id,
	agent_slug,
	commit_sha,
	status,
	1,
	started_at,
	COALESCE(finished_at, started_at),
	json_object(
		'triggerSource', trigger_source,
		'handlerKind', handler_kind,
		'triggerKind', trigger_kind,
		'selectedItemKey', selected_item_key,
		'selectedMessageId', selected_message_id,
		'claimedMessageId', claimed_message_id,
		'branchName', branch_name,
		'prUrl', pr_url,
		'summary', summary,
		'error', error,
		'errorCategory', error_category,
		'commitSha', commit_sha,
		'changedPaths', json(COALESCE(changed_paths, '[]')),
		'finishedAt', finished_at
	),
	json_object(
		'runId', run_id,
		'agentSlug', agent_slug
	)
FROM agent_runs;

INSERT OR IGNORE INTO message_queue (
	id,
	message_type,
	status,
	schema_version,
	related_model,
	related_id,
	priority,
	available_at,
	claimed_by,
	claimed_at,
	lease_expires_at,
	attempts,
	max_attempts,
	created_at,
	updated_at,
	payload_json,
	meta_json
)
SELECT
	id,
	type,
	status,
	1,
	related_model,
	related_id,
	priority,
	available_at,
	claimed_by,
	claimed_at,
	lease_expires_at,
	attempts,
	max_attempts,
	created_at,
	updated_at,
	json_object('body', json(COALESCE(payload_json, '{}'))),
	json('{}')
FROM messages;

INSERT OR IGNORE INTO cursor_state (
	agent_slug,
	cursor_key,
	status,
	schema_version,
	updated_at,
	payload_json,
	meta_json
)
SELECT
	agent_slug,
	cursor_key,
	'active',
	1,
	updated_at,
	json_object('cursorValue', cursor_value),
	json('{}')
FROM agent_cursors;

INSERT OR IGNORE INTO lease_state (
	model,
	item_key,
	status,
	schema_version,
	claimed_by,
	claimed_at,
	lease_expires_at,
	created_at,
	updated_at,
	payload_json,
	meta_json
)
SELECT
	model,
	item_key,
	'claimed',
	1,
	claimed_by,
	claimed_at,
	lease_expires_at,
	claimed_at,
	lease_expires_at,
	json_object('token', token),
	json('{}')
FROM content_leases;
