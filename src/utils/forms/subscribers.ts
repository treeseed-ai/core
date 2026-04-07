import { hashValue } from './crypto';
import type { D1DatabaseLike } from '../../types/cloudflare';
import type { SubscriberRecordInput } from '../../types/forms';

async function hasRuntimeRecordsTable(db: D1DatabaseLike) {
	const row = await db
		.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'runtime_records' LIMIT 1")
		.first<{ name?: string }>();
	return Boolean(row?.name);
}

export async function upsertSubscriber(
	db: D1DatabaseLike,
	input: SubscriberRecordInput,
) {
	const now = new Date().toISOString();
	const ipHash = await hashValue(input.ip || 'unknown');
	if (await hasRuntimeRecordsTable(db)) {
		const payloadJson = JSON.stringify({
			email: input.email,
			name: input.name || null,
			source: input.source,
			consentAt: now,
			ipHash,
		});
		const metaJson = JSON.stringify({});

		await db
			.prepare(
				`INSERT INTO runtime_records (
					record_type,
					record_key,
					lookup_key,
					status,
					schema_version,
					created_at,
					updated_at,
					payload_json,
					meta_json
				) VALUES (?, ?, ?, 'active', 1, ?, ?, ?, ?)
				ON CONFLICT(record_type, record_key) DO UPDATE SET
					lookup_key = excluded.lookup_key,
					status = 'active',
					updated_at = excluded.updated_at,
					payload_json = excluded.payload_json,
					meta_json = excluded.meta_json`,
			)
			.bind('subscription', input.email, input.email, now, now, payloadJson, metaJson)
			.run();
		return;
	}

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
}
