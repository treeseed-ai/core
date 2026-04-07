import { hashValue } from './crypto';
import type { D1DatabaseLike } from '../../types/cloudflare';
import type { ContactRecordInput } from '../../types/forms';

async function hasRuntimeRecordsTable(db: D1DatabaseLike) {
	const row = await db
		.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'runtime_records' LIMIT 1")
		.first<{ name?: string }>();
	return Boolean(row?.name);
}

export async function createContactSubmission(
	db: D1DatabaseLike,
	input: ContactRecordInput,
) {
	const now = new Date().toISOString();
	const ipHash = await hashValue(input.ip || 'unknown');
	if (await hasRuntimeRecordsTable(db)) {
		const payloadJson = JSON.stringify({
			name: input.name,
			email: input.email,
			organization: input.organization || null,
			contactType: input.contactType,
			subject: input.subject,
			message: input.message,
			userAgent: input.userAgent || 'unknown user agent',
			ipHash,
		});
		const metaJson = JSON.stringify({});

		await db
			.prepare(
				`INSERT INTO runtime_records (
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
				) VALUES (?, ?, ?, ?, 'received', 1, ?, ?, ?, ?)`,
			)
			.bind(
				'contact_submission',
				`${input.email}:${now}`,
				input.email,
				input.contactType,
				now,
				now,
				payloadJson,
				metaJson,
			)
			.run();
		return;
	}

	await db
		.prepare(
			`INSERT INTO contact_submissions (
				name,
				email,
				organization,
				contact_type,
				subject,
				message,
				user_agent,
				created_at,
				ip_hash
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			input.name,
			input.email,
			input.organization || null,
			input.contactType,
			input.subject,
			input.message,
			input.userAgent || 'unknown user agent',
			now,
			ipHash,
		)
		.run();
}
