import { hashValue } from '../security/crypto';
import type { ContactRecordInput } from '../../../types/forms';

interface LocalContactSubmissionRecord {
	name: string;
	email: string;
	organization: string;
	contactType: string;
	subject: string;
	message: string;
	userAgent: string;
	createdAt: string;
	ipHash: string;
}

const localContactSubmissions =
	(globalThis as { FixtureContactSubmissions?: LocalContactSubmissionRecord[] }).FixtureContactSubmissions
	?? [];

(globalThis as { FixtureContactSubmissions?: LocalContactSubmissionRecord[] }).FixtureContactSubmissions =
	localContactSubmissions;

export async function createLocalContactSubmission(input: ContactRecordInput) {
	localContactSubmissions.push({
		name: input.name,
		email: input.email,
		organization: input.organization,
		contactType: input.contactType,
		subject: input.subject,
		message: input.message,
		userAgent: input.userAgent || 'unknown user agent',
		createdAt: new Date().toISOString(),
		ipHash: await hashValue(input.ip || 'unknown'),
	});
}
