import { hashValue } from './crypto';
import type { SubscriberRecordInput } from '../../types/forms';

interface LocalSubscriberRecord {
	email: string;
	name: string;
	source: string;
	status: string;
	consentAt: string;
	createdAt: string;
	updatedAt: string;
	ipHash: string;
}

const localSubscribers =
	(globalThis as { __karyonDocsSubscribers?: Map<string, LocalSubscriberRecord> }).__karyonDocsSubscribers
	?? new Map<string, LocalSubscriberRecord>();

(globalThis as { __karyonDocsSubscribers?: Map<string, LocalSubscriberRecord> }).__karyonDocsSubscribers = localSubscribers;

export async function upsertLocalSubscriber(input: SubscriberRecordInput) {
	const now = new Date().toISOString();
	const ipHash = await hashValue(input.ip || 'unknown');
	const existing = localSubscribers.get(input.email);

	localSubscribers.set(input.email, {
		email: input.email,
		name: input.name,
		source: input.source,
		status: 'active',
		consentAt: now,
		createdAt: existing?.createdAt ?? now,
		updatedAt: now,
		ipHash,
	});
}
