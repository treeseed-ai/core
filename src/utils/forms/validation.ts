import { CONTACT_TYPES, type ContactSubmission, type FormSubmitPayload, type SubscribeSubmission } from '../../types/forms';

function normalizeEmail(value: FormDataEntryValue | null) {
	return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function readText(value: FormDataEntryValue | null) {
	return typeof value === 'string' ? value.trim() : '';
}

export function parsePayload(formData: FormData): FormSubmitPayload | null {
	const formType = readText(formData.get('formType'));

	if (formType === 'contact') {
		const contactType = readText(formData.get('contactType'));
		if (!CONTACT_TYPES.includes(contactType as (typeof CONTACT_TYPES)[number])) {
			return null;
		}

		const payload: ContactSubmission = {
			formType,
			name: readText(formData.get('name')),
			email: normalizeEmail(formData.get('email')),
			organization: readText(formData.get('organization')),
			contactType: contactType as ContactSubmission['contactType'],
			subject: readText(formData.get('subject')),
			message: readText(formData.get('message')),
		};

		return payload;
	}

	if (formType === 'subscribe') {
		const payload: SubscribeSubmission = {
			formType,
			email: normalizeEmail(formData.get('email')),
			name: readText(formData.get('name')),
		};

		return payload;
	}

	return null;
}

export function validatePayload(payload: FormSubmitPayload) {
	if (payload.formType === 'contact') {
		if (!payload.name || !payload.email || !payload.subject || !payload.message) {
			return { ok: false as const, message: 'Please complete the required contact fields.' };
		}

		if (payload.message.length < 10) {
			return { ok: false as const, message: 'Please share a bit more detail in your message.' };
		}
	}

	if (payload.formType === 'subscribe') {
		if (!payload.email) {
			return { ok: false as const, message: 'Please provide your email address.' };
		}
	}

	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
		return { ok: false as const, message: 'Please enter a valid email address.' };
	}

	return { ok: true as const };
}
