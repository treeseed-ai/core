CREATE TABLE IF NOT EXISTS subscriptions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	email TEXT NOT NULL UNIQUE,
	name TEXT,
	status TEXT NOT NULL DEFAULT 'active',
	source TEXT NOT NULL,
	consent_at TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	ip_hash TEXT NOT NULL
);

INSERT OR IGNORE INTO subscriptions (id, email, name, status, source, consent_at, created_at, updated_at, ip_hash)
SELECT id, email, name, status, source, consent_at, created_at, updated_at, ip_hash
FROM subscribers;

CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_updated_at ON subscriptions(updated_at);

CREATE TABLE IF NOT EXISTS messages (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	type TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'pending',
	payload_json TEXT NOT NULL,
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
	updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_type_status_priority_available
	ON messages(type, status, priority DESC, available_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_claimed_by_lease
	ON messages(claimed_by, lease_expires_at);
CREATE INDEX IF NOT EXISTS idx_messages_updated_at
	ON messages(updated_at);

CREATE TABLE IF NOT EXISTS agent_runs (
	run_id TEXT PRIMARY KEY,
	agent_slug TEXT NOT NULL,
	trigger_source TEXT NOT NULL,
	status TEXT NOT NULL,
	selected_item_key TEXT,
	selected_message_id INTEGER,
	branch_name TEXT,
	pr_url TEXT,
	summary TEXT,
	error TEXT,
	started_at TEXT NOT NULL,
	finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_started
	ON agent_runs(agent_slug, started_at DESC);

CREATE TABLE IF NOT EXISTS agent_cursors (
	agent_slug TEXT NOT NULL,
	cursor_key TEXT NOT NULL,
	cursor_value TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	PRIMARY KEY (agent_slug, cursor_key)
);

CREATE TABLE IF NOT EXISTS content_leases (
	model TEXT NOT NULL,
	item_key TEXT NOT NULL,
	claimed_by TEXT NOT NULL,
	claimed_at TEXT NOT NULL,
	lease_expires_at TEXT NOT NULL,
	token TEXT NOT NULL,
	PRIMARY KEY (model, item_key)
);

CREATE INDEX IF NOT EXISTS idx_content_leases_lookup
	ON content_leases(model, item_key, lease_expires_at);
