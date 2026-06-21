import { hashValue } from './crypto';
import type { D1DatabaseLike } from '../../types/cloudflare';
import type { SubscriberRecordInput } from '../../types/forms';

async function hasTable(db: D1DatabaseLike, tableName: string) {
	const row = await db
		.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
		.bind(tableName)
		.first<{ name?: string }>();
	return Boolean(row?.name);
}

export async function upsertSubscriber(
	db: D1DatabaseLike,
	input: SubscriberRecordInput,
) {
	const now = new Date().toISOString();
	const ipHash = await hashValue(input.ip || 'unknown');
	if (await hasTable(db, 'subscriptions')) {
		await db
			.prepare(
				`INSERT INTO subscriptions (email, name, status, source, consent_at, created_at, updated_at, ip_hash)
				 VALUES (?, ?, 'active', ?, ?, ?, ?, ?)
				 ON CONFLICT(email) DO UPDATE SET
				 	name = excluded.name,
				 	status = 'active',
				 	source = excluded.source,
				 	consent_at = excluded.consent_at,
				 	updated_at = excluded.updated_at,
				 	ip_hash = excluded.ip_hash`,
			)
			.bind(input.email, input.name || null, input.source, now, now, now, ipHash)
			.run();
		return;
	}

	await db
		.prepare(
			`INSERT INTO subscribers (email, created_at)
			 VALUES (?, ?)
			 ON CONFLICT(email) DO NOTHING`,
		)
		.bind(input.email, now)
		.run();
}
