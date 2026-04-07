CREATE TABLE IF NOT EXISTS contact_submissions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	email TEXT NOT NULL,
	organization TEXT,
	contact_type TEXT NOT NULL,
	subject TEXT NOT NULL,
	message TEXT NOT NULL,
	user_agent TEXT NOT NULL,
	created_at TEXT NOT NULL,
	ip_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at
	ON contact_submissions(created_at DESC);
