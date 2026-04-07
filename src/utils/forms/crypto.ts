import { FORM_TOKEN_TTL_MS } from './constants';
import type { SignedFormTokenPayload } from '../../types/forms';

function base64UrlEncode(input: Uint8Array) {
	let binary = '';
	for (const value of input) {
		binary += String.fromCharCode(value);
	}

	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(input: string) {
	const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
	const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
	const binary = atob(padded);
	return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function importHmacKey(secret: string) {
	return crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify'],
	);
}

export async function signFormToken(payload: SignedFormTokenPayload, secret: string) {
	const serialized = JSON.stringify(payload);
	const encodedPayload = base64UrlEncode(new TextEncoder().encode(serialized));
	const key = await importHmacKey(secret);
	const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedPayload));
	return `${encodedPayload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifyFormToken(token: string, secret: string) {
	const [encodedPayload, encodedSignature] = token.split('.');

	if (!encodedPayload || !encodedSignature) {
		return { ok: false as const, reason: 'malformed' };
	}

	const key = await importHmacKey(secret);
	const isValid = await crypto.subtle.verify(
		'HMAC',
		key,
		base64UrlDecode(encodedSignature),
		new TextEncoder().encode(encodedPayload),
	);

	if (!isValid) {
		return { ok: false as const, reason: 'signature' };
	}

	const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload))) as SignedFormTokenPayload;

	if (Date.now() - payload.issuedAt > FORM_TOKEN_TTL_MS) {
		return { ok: false as const, reason: 'expired', payload };
	}

	return { ok: true as const, payload };
}

export function createOpaqueId() {
	return crypto.randomUUID();
}

export async function hashValue(value: string) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest))
		.map((entry) => entry.toString(16).padStart(2, '0'))
		.join('');
}
