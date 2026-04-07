import { describe, expect, it } from 'vitest';
import { applySubmissionRateLimit, assertNonceUnused } from '../../../src/utils/forms/guard';
import type { KvNamespaceLike } from '../../../src/types/cloudflare';

class MemoryKv implements KvNamespaceLike {
	private store = new Map<string, string>();

	async get(key: string) {
		return this.store.get(key) ?? null;
	}

	async put(key: string, value: string) {
		this.store.set(key, value);
	}
}

describe('form guard helpers', () => {
	it('only allows a nonce once', async () => {
		const kv = new MemoryKv();
		expect(await assertNonceUnused(kv, 'nonce-1')).toBe(true);
		expect(await assertNonceUnused(kv, 'nonce-1')).toBe(false);
	});

	it('applies a cooldown after repeated submissions', async () => {
		const kv = new MemoryKv();

		expect(await applySubmissionRateLimit(kv, '127.0.0.1', 'person@example.com', 'contact')).toBe(true);
		expect(await applySubmissionRateLimit(kv, '127.0.0.1', 'person@example.com', 'contact')).toBe(true);
		expect(await applySubmissionRateLimit(kv, '127.0.0.1', 'person@example.com', 'contact')).toBe(true);
		expect(await applySubmissionRateLimit(kv, '127.0.0.1', 'person@example.com', 'contact')).toBe(false);
	});
});
