import { describe, expect, it } from 'vitest';
import { parsePayload, validatePayload } from '../../../src/utils/forms/validation';

describe('form payload validation', () => {
	it('parses and validates a contact submission', () => {
		const formData = new FormData();
		formData.set('formType', 'contact');
		formData.set('name', 'Ada');
		formData.set('email', 'Ada@Example.com');
		formData.set('organization', 'Karyon');
		formData.set('contactType', 'feedback');
		formData.set('subject', 'Thoughtful feedback');
		formData.set('message', 'This is a sufficiently detailed feedback message.');

		const payload = parsePayload(formData);
		expect(payload?.formType).toBe('contact');
		expect(payload && validatePayload(payload).ok).toBe(true);
	});

	it('accepts subscribe submissions with an email address', () => {
		const formData = new FormData();
		formData.set('formType', 'subscribe');
		formData.set('email', 'reader@example.com');
		formData.set('name', 'Reader');

		const payload = parsePayload(formData);
		expect(payload?.formType).toBe('subscribe');
		expect(payload && validatePayload(payload).ok).toBe(true);
	});

	it('rejects unknown contact types', () => {
		const formData = new FormData();
		formData.set('formType', 'contact');
		formData.set('contactType', 'unknown');

		expect(parsePayload(formData)).toBeNull();
	});
});
