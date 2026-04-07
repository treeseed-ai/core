import { describe, expect, it } from 'vitest';
import { signFormToken, verifyFormToken } from '../../../src/utils/forms/crypto';

describe('form token signing', () => {
	it('round-trips a signed token payload', async () => {
		const token = await signFormToken(
			{
				formType: 'contact',
				sessionId: 'session-1',
				nonce: 'nonce-1',
				issuedAt: Date.now(),
			},
			'secret-value',
		);

		const result = await verifyFormToken(token, 'secret-value');

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.payload.sessionId).toBe('session-1');
			expect(result.payload.formType).toBe('contact');
		}
	});

	it('rejects a token signed with the wrong secret', async () => {
		const token = await signFormToken(
			{
				formType: 'subscribe',
				sessionId: 'session-2',
				nonce: 'nonce-2',
				issuedAt: Date.now(),
			},
			'right-secret',
		);

		const result = await verifyFormToken(token, 'wrong-secret');
		expect(result.ok).toBe(false);
	});
});
