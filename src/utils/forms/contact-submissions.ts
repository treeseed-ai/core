import { hashValue } from './crypto';
import type { D1DatabaseLike } from '../../types/cloudflare';
import type { ContactRecordInput } from '../../types/forms';

async function tableColumns(db: D1DatabaseLike, tableName: 'contact_submissions') {
	const { results } = await db
		.prepare(`PRAGMA table_info(${tableName})`)
		.all<{ name?: string }>();
	return new Set(results.map((row) => row.name).filter((name): name is string => Boolean(name)));
}

export async function createContactSubmission(
	db: D1DatabaseLike,
	input: ContactRecordInput,
) {
	const now = new Date().toISOString();
	const ipHash = await hashValue(input.ip || 'unknown');
	const columns = await tableColumns(db, 'contact_submissions');
	if (!columns.has('contact_type')) {
		await db
			.prepare(
				`INSERT INTO contact_submissions (
					email,
					message,
					created_at
				) VALUES (?, ?, ?)`,
			)
			.bind(
				input.email,
				[
					input.subject,
					'',
					input.message,
					'',
					`Name: ${input.name}`,
					input.organization ? `Organization: ${input.organization}` : null,
					`Contact type: ${input.contactType}`,
				].filter(Boolean).join('\n'),
				now,
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
