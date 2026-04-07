import { describe, expect, it } from 'vitest';
import { resolveContactRecipientsFromMap } from '../../../src/utils/forms/routing-core';
import { SITE_EMAIL_NOTIFICATIONS } from '../../../src/utils/site-config';

describe('contact routing resolution', () => {
	it('prefers a specific route over the default recipients', () => {
		const recipients = resolveContactRecipientsFromMap(
			{
				default: ['default@example.com'],
				feedback: ['feedback@example.com'],
			},
			'feedback',
		);

		expect(recipients).toEqual(['feedback@example.com']);
	});

	it('falls back to default recipients', () => {
		const recipients = resolveContactRecipientsFromMap(
			{
				default: ['default@example.com'],
			},
			'issue',
		);

		expect(recipients).toEqual(['default@example.com']);
	});

	it('accepts the config.yaml routing map shape', () => {
		const recipients = resolveContactRecipientsFromMap(
			SITE_EMAIL_NOTIFICATIONS.contactRouting,
			'collaboration',
		);

		expect(recipients).toEqual(['contact@karyon.life']);
	});
});
