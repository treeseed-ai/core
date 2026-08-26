import { createHmac, randomBytes } from 'node:crypto';

export function createSignedUserAssertion(input: {
	secret: string;
	userId: string;
	sessionId: string | null;
	identityId: string | null;
	authTime: string;
}) {
	const payload = Buffer.from(JSON.stringify({
		userId: input.userId,
		sessionId: input.sessionId,
		identityId: input.identityId,
		authTime: input.authTime,
		expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
		nonce: randomBytes(16).toString('base64url'),
	}), 'utf8').toString('base64url');
	return `${payload}.${createHmac('sha256', input.secret).update(payload).digest('base64url')}`;
}
