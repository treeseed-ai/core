import { NONCE_TTL_SECONDS, RATE_LIMIT_MAX_ATTEMPTS, RATE_LIMIT_TTL_SECONDS } from './constants';
import { hashValue } from './crypto';
import type { KvNamespaceLike } from '../../types/cloudflare';

type CounterRecord = { count: number; expiresAt: number };

const localNonceStore = (globalThis as { __karyonDocsNonceStore?: Map<string, number> }).__karyonDocsNonceStore
	?? new Map<string, number>();
const localRateStore = (globalThis as { __karyonDocsRateStore?: Map<string, CounterRecord> }).__karyonDocsRateStore
	?? new Map<string, CounterRecord>();

(globalThis as { __karyonDocsNonceStore?: Map<string, number> }).__karyonDocsNonceStore = localNonceStore;
(globalThis as { __karyonDocsRateStore?: Map<string, CounterRecord> }).__karyonDocsRateStore = localRateStore;

async function incrementCounter(kv: KvNamespaceLike, key: string, ttl: number) {
	const currentValue = await kv.get(key);
	const nextValue = (Number.parseInt(currentValue ?? '0', 10) || 0) + 1;
	await kv.put(key, String(nextValue), { expirationTtl: ttl });
	return nextValue;
}

export async function assertNonceUnused(kv: KvNamespaceLike, nonce: string) {
	const nonceKey = `nonce:${nonce}`;
	const current = await kv.get(nonceKey);

	if (current) {
		return false;
	}

	await kv.put(nonceKey, '1', { expirationTtl: NONCE_TTL_SECONDS });
	return true;
}

export async function applySubmissionRateLimit(
	kv: KvNamespaceLike,
	remoteIp: string,
	email: string,
	formType: string,
) {
	const ipHash = remoteIp ? await hashValue(remoteIp) : 'unknown';
	const emailHash = await hashValue(email);
	const ipKey = `rate:${formType}:ip:${ipHash}`;
	const emailKey = `rate:${formType}:email:${emailHash}`;

	const [ipCount, emailCount] = await Promise.all([
		incrementCounter(kv, ipKey, RATE_LIMIT_TTL_SECONDS),
		incrementCounter(kv, emailKey, RATE_LIMIT_TTL_SECONDS),
	]);

	return ipCount <= RATE_LIMIT_MAX_ATTEMPTS && emailCount <= RATE_LIMIT_MAX_ATTEMPTS;
}

function pruneExpiredLocalState() {
	const now = Date.now();

	for (const [nonce, expiresAt] of localNonceStore.entries()) {
		if (expiresAt <= now) {
			localNonceStore.delete(nonce);
		}
	}

	for (const [key, record] of localRateStore.entries()) {
		if (record.expiresAt <= now) {
			localRateStore.delete(key);
		}
	}
}

export async function assertNonceUnusedLocal(nonce: string) {
	pruneExpiredLocalState();
	if (localNonceStore.has(nonce)) {
		return false;
	}

	localNonceStore.set(nonce, Date.now() + NONCE_TTL_SECONDS * 1000);
	return true;
}

async function incrementLocalCounter(key: string, ttlSeconds: number) {
	pruneExpiredLocalState();
	const currentRecord = localRateStore.get(key);
	const nextCount = (currentRecord?.count ?? 0) + 1;
	localRateStore.set(key, {
		count: nextCount,
		expiresAt: Date.now() + ttlSeconds * 1000,
	});
	return nextCount;
}

export async function applySubmissionRateLimitLocal(remoteIp: string, email: string, formType: string) {
	const ipHash = remoteIp ? await hashValue(remoteIp) : 'unknown';
	const emailHash = await hashValue(email);
	const ipCount = await incrementLocalCounter(`rate:${formType}:ip:${ipHash}`, RATE_LIMIT_TTL_SECONDS);
	const emailCount = await incrementLocalCounter(`rate:${formType}:email:${emailHash}`, RATE_LIMIT_TTL_SECONDS);
	return ipCount <= RATE_LIMIT_MAX_ATTEMPTS && emailCount <= RATE_LIMIT_MAX_ATTEMPTS;
}
