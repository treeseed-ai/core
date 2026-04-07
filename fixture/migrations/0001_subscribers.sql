CREATE TABLE IF NOT EXISTS subscribers (
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

CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);
