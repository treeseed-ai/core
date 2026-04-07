import type {
	ContactSubmissionStore,
	FormRuntimeCapabilities,
	GuardStore,
	SubscriberStore,
} from '../../types/forms';
import type { D1DatabaseLike, KvNamespaceLike } from '../../types/cloudflare';
import { assertNonceUnused, assertNonceUnusedLocal, applySubmissionRateLimit, applySubmissionRateLimitLocal } from './guard';
import { createContactSubmission } from './contact-submissions';
import { upsertSubscriber } from './subscribers';
import { sendEmail as sendDefaultEmail } from './smtp';
import { verifyTurnstileToken as verifyDefaultTurnstileToken } from './turnstile';

interface FormEmailOptions {
	smtp: {
		host: string;
		port: number;
		username: string;
		password: string;
		from: string;
		replyTo: string;
	};
	siteUrl: string;
}

interface FormProviderBehavior {
	contact: {
		notifyAdmin: boolean;
		requireSmtp: boolean;
	};
	subscribe: {
		notifyAdmin: boolean;
		sendConfirmation: boolean;
		requireSmtp: boolean;
	};
}

export interface TreeseedFormsProvider {
	id: string;
	behavior: FormProviderBehavior;
	createGuardStore?(input: { runtime: FormRuntimeCapabilities; kv: KvNamespaceLike | null }): GuardStore;
	createSubscriberStore?(input: { runtime: FormRuntimeCapabilities; db: D1DatabaseLike | null }): SubscriberStore;
	createContactStore?(input: {
		runtime: FormRuntimeCapabilities;
		db: D1DatabaseLike | null;
	}): ContactSubmissionStore;
	sendEmail?(
		message: { to: string[]; subject: string; text: string; replyTo?: string },
		runtime: FormRuntimeCapabilities,
		options: FormEmailOptions,
	): Promise<void>;
	verifyTurnstileToken?(
		token: string,
		remoteIp: string,
		expectedAction: string,
		runtime: FormRuntimeCapabilities,
		secret: string,
	): Promise<{ ok: true; bypassed?: boolean } | { ok: false; reason: string; errors?: string[] }>;
}

function createDefaultGuardStore(runtime: FormRuntimeCapabilities, kv: KvNamespaceLike | null): GuardStore {
	return {
		assertNonceUnused(nonce: string) {
			if (runtime.isCloudflareRuntime && kv && !runtime.bypassCloudflareGuards) {
				return assertNonceUnused(kv, nonce);
			}

			return assertNonceUnusedLocal(nonce);
		},
		applyRateLimit(remoteIp: string, email: string, formType: string) {
			if (runtime.isCloudflareRuntime && kv && !runtime.bypassCloudflareGuards) {
				return applySubmissionRateLimit(kv, remoteIp, email, formType);
			}

			return applySubmissionRateLimitLocal(remoteIp, email, formType);
		},
	};
}

function createDefaultSubscriberStore(runtime: FormRuntimeCapabilities, db: D1DatabaseLike | null): SubscriberStore {
	return {
		async upsert(input) {
			if (runtime.isCloudflareRuntime && db) {
				return upsertSubscriber(db, input);
			}

			const { upsertLocalSubscriber } = await import('./subscribers-local');
			return upsertLocalSubscriber(input);
		},
	};
}

function createDefaultContactStore(runtime: FormRuntimeCapabilities, db: D1DatabaseLike | null): ContactSubmissionStore {
	return {
		async create(input) {
			if (runtime.isCloudflareRuntime && db) {
				return createContactSubmission(db, input);
			}

			const { createLocalContactSubmission } = await import('./contact-submissions-local');
			return createLocalContactSubmission(input);
		},
	};
}

export const BUILTIN_FORMS_PROVIDERS: Record<string, TreeseedFormsProvider> = {
	store_only: {
		id: 'store_only',
		behavior: {
			contact: { notifyAdmin: false, requireSmtp: false },
			subscribe: { notifyAdmin: false, sendConfirmation: false, requireSmtp: false },
		},
	},
	notify_admin: {
		id: 'notify_admin',
		behavior: {
			contact: { notifyAdmin: true, requireSmtp: false },
			subscribe: { notifyAdmin: true, sendConfirmation: false, requireSmtp: false },
		},
	},
	full_email: {
		id: 'full_email',
		behavior: {
			contact: { notifyAdmin: true, requireSmtp: true },
			subscribe: { notifyAdmin: true, sendConfirmation: true, requireSmtp: true },
		},
	},
};

export function finalizeFormsProvider(provider: TreeseedFormsProvider): Required<TreeseedFormsProvider> {
	return {
		...provider,
		createGuardStore: provider.createGuardStore ?? ((input) => createDefaultGuardStore(input.runtime, input.kv)),
		createSubscriberStore:
			provider.createSubscriberStore ?? ((input) => createDefaultSubscriberStore(input.runtime, input.db)),
		createContactStore:
			provider.createContactStore ?? ((input) => createDefaultContactStore(input.runtime, input.db)),
		sendEmail: provider.sendEmail ?? sendDefaultEmail,
		verifyTurnstileToken: provider.verifyTurnstileToken ?? verifyDefaultTurnstileToken,
	};
}

export function resolveBuiltinFormsProvider(providerId: string) {
	const provider = BUILTIN_FORMS_PROVIDERS[providerId];
	if (!provider) {
		throw new Error(`Treeseed built-in forms provider "${providerId}" is not registered.`);
	}
	return finalizeFormsProvider(provider);
}
