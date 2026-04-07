import { CONTACT_TYPE_LABELS, FORM_SESSION_COOKIE, HONEYPOT_FIELD } from './constants';
import { buildRedirectTarget, getRemoteIp, sanitizeRedirectTo } from './http';
import { issueFormToken, verifyIssuedToken, createSessionCookie } from './session';
import { parsePayload, validatePayload } from './validation';
import { hashValue } from './crypto';
import { resolveContactRecipientsFromMap } from './routing-core';
import type { TreeseedFormsProvider } from './provider-core';
import type {
	ContactSubmission,
	ContactSubmissionStore,
	ContactRoutingMap,
	FormRuntimeCapabilities,
	FormSubmitPayload,
	SubmitResult,
	SubscribeSubmission,
	SubscriberStore,
} from '../../types/forms';

interface SmtpConfig {
	host: string;
	port: number;
	username: string;
	password: string;
	from: string;
	replyTo: string;
}

export interface FormServiceBindings {
	FORM_GUARD_KV?: KvNamespaceLike | null;
	SITE_DATA_DB?: D1DatabaseLike | null;
	SESSION?: KvNamespaceLike | null;
}

export interface FormServiceConfig {
	runtime: FormRuntimeCapabilities;
	bindings?: FormServiceBindings | null;
	formsProvider: Required<TreeseedFormsProvider>;
	formSecret: string;
	turnstileSecret?: string;
	contactRouting: ContactRoutingMap;
	subscribeRecipients: string[];
	smtpConfig: SmtpConfig;
	siteUrl: string;
}

export interface FormRequestContext {
	request: Request;
	url: URL;
	getCookie(name: string): string | undefined;
	redirect(location: string, status: number): Response;
	setCookie?(cookie: { name: string; value: string; options: Record<string, unknown> }): void;
}

function resultFor(formType: FormSubmitPayload['formType'], redirectTo: string, ok: boolean, code: SubmitResult['code'], message: string): SubmitResult {
	return {
		ok,
		code,
		message,
		redirectTo: buildRedirectTarget(formType, redirectTo, ok, code),
	};
}

function summarizeRequest(request: Request) {
	return request.headers.get('user-agent') ?? 'unknown user agent';
}

async function buildContactMessage(payload: ContactSubmission, remoteIp: string, request: Request) {
	const ipHash = await hashValue(remoteIp || 'unknown');
	return [
		'Karyon contact form submission',
		'',
		`Name: ${payload.name}`,
		`Email: ${payload.email}`,
		`Organization: ${payload.organization || 'n/a'}`,
		`Contact type: ${CONTACT_TYPE_LABELS[payload.contactType]}`,
		`Subject: ${payload.subject}`,
		'',
		payload.message,
		'',
		'Metadata',
		`Timestamp: ${new Date().toISOString()}`,
		`IP hash: ${ipHash}`,
		`User agent: ${summarizeRequest(request)}`,
	].join('\n');
}

async function sendContactEmail(
	payload: ContactSubmission,
	remoteIp: string,
	request: Request,
	runtime: FormRuntimeCapabilities,
	config: FormServiceConfig,
	formsProvider = config.formsProvider,
) {
	const recipients = resolveContactRecipientsFromMap(config.contactRouting, payload.contactType);
	if (!recipients.length) {
		throw new Error('No contact recipients configured for this route.');
	}

	await formsProvider.sendEmail(
		{
			to: recipients,
			subject: `[Karyon Contact] ${payload.subject}`,
			text: await buildContactMessage(payload, remoteIp, request),
			replyTo: payload.email,
		},
		runtime,
		{ smtp: config.smtpConfig, siteUrl: config.siteUrl },
	);
}

async function persistContactSubmission(
	payload: ContactSubmission,
	remoteIp: string,
	request: Request,
	contactStore: ContactSubmissionStore,
) {
	await contactStore.create({
		name: payload.name,
		email: payload.email,
		organization: payload.organization,
		contactType: payload.contactType,
		subject: payload.subject,
		message: payload.message,
		ip: remoteIp,
		userAgent: summarizeRequest(request),
	});
}

async function handleSubscribe(
	payload: SubscribeSubmission,
	remoteIp: string,
	request: Request,
	subscriberStore: SubscriberStore,
	runtime: FormRuntimeCapabilities,
	config: FormServiceConfig,
	formsProvider = config.formsProvider,
) {
	await subscriberStore.upsert({
		email: payload.email,
		name: payload.name,
		source: 'footer',
		ip: remoteIp,
	});

	const notifyRecipients = config.subscribeRecipients;
	const ipHash = await hashValue(remoteIp || 'unknown');

	if (!formsProvider.behavior.subscribe.notifyAdmin && !formsProvider.behavior.subscribe.sendConfirmation) {
		return;
	}

	const notifyAdmin = async () => {
		if (!notifyRecipients.length) {
			return;
		}

		await formsProvider.sendEmail({
			to: notifyRecipients,
			subject: '[Karyon Updates] New subscriber',
			text: [
				'Karyon updates signup',
				'',
				`Email: ${payload.email}`,
				`Name: ${payload.name || 'n/a'}`,
				`Timestamp: ${new Date().toISOString()}`,
				`IP hash: ${ipHash}`,
				`User agent: ${summarizeRequest(request)}`,
			].join('\n'),
		}, runtime, { smtp: config.smtpConfig, siteUrl: config.siteUrl });
	};

	if (!formsProvider.behavior.subscribe.sendConfirmation) {
		if (formsProvider.behavior.subscribe.requireSmtp && !runtime.smtpEnabled) {
			return;
		}

		try {
			await notifyAdmin();
		} catch (error) {
			console.warn('Subscriber notification email failed', error);
		}
		return;
	}

	if (!runtime.smtpEnabled) {
		throw new Error('SMTP is required for full_email subscribe delivery.');
	}

	await notifyAdmin();

	await formsProvider.sendEmail({
		to: [payload.email],
		subject: 'You are subscribed to Karyon updates',
		text: [
			'Thanks for subscribing to Karyon updates.',
			'',
			'We will use this address to send occasional product, research, and publication updates as that workflow comes online.',
			'',
			'You can reply to this email if you need anything in the meantime.',
		].join('\n'),
	}, runtime, { smtp: config.smtpConfig, siteUrl: config.siteUrl });
}

export async function handleTokenRequestWithConfig(context: FormRequestContext, config: FormServiceConfig) {
	const formType = context.url.searchParams.get('formType');
	if (formType !== 'contact' && formType !== 'subscribe') {
		return new Response(JSON.stringify({ ok: false, message: 'Unknown form type.' }), {
			status: 400,
			headers: { 'content-type': 'application/json' },
		});
	}

	const issued = await issueFormToken(formType, config.formSecret);
	const cookie = createSessionCookie(issued.sessionId, context.url);
	context.setCookie?.(cookie);

	return new Response(
		JSON.stringify({
			ok: true,
			formToken: issued.formToken,
			sessionId: issued.sessionId,
		}),
		{
			headers: {
				'content-type': 'application/json',
				'cache-control': 'no-store',
			},
		},
	);
}

export async function handleFormSubmissionWithConfig(context: FormRequestContext, config: FormServiceConfig) {
	const bindings = config.bindings ?? {};
	const runtime = config.runtime;
	const formsProvider = config.formsProvider;
	const guardStore = formsProvider.createGuardStore({
		runtime,
		kv: bindings.FORM_GUARD_KV ?? null,
	});
	const subscriberStore = formsProvider.createSubscriberStore({
		runtime,
		db: bindings.SITE_DATA_DB ?? null,
	});
	const contactStore = formsProvider.createContactStore({
		runtime,
		db: bindings.SITE_DATA_DB ?? null,
	});
	const formData = await context.request.formData();
	const payload = parsePayload(formData);

	const formTypeValue = typeof formData.get('formType') === 'string' ? String(formData.get('formType')) : 'contact';
	const normalizedFormType = formTypeValue === 'subscribe' ? 'subscribe' : 'contact';
	const redirectTo = sanitizeRedirectTo(
		typeof formData.get('redirectTo') === 'string' ? String(formData.get('redirectTo')) : null,
		normalizedFormType,
		context.url,
	);

	if (typeof formData.get(HONEYPOT_FIELD) === 'string' && String(formData.get(HONEYPOT_FIELD)).trim()) {
		return resultFor(normalizedFormType, redirectTo, false, 'invalid_request', 'Spam protection triggered.');
	}

	if (!payload) {
		return resultFor(normalizedFormType, redirectTo, false, 'invalid_form', 'The submitted form data was invalid.');
	}

	const validation = validatePayload(payload);
	if (!validation.ok) {
		return resultFor(payload.formType, redirectTo, false, 'invalid_form', validation.message);
	}

	const cookieSessionId = context.getCookie(FORM_SESSION_COOKIE) ?? '';
	const postedSessionId = typeof formData.get('formSession') === 'string' ? String(formData.get('formSession')).trim() : '';
	const formToken = typeof formData.get('formToken') === 'string' ? String(formData.get('formToken')) : '';
	const sessionCandidates = Array.from(new Set([cookieSessionId, postedSessionId].filter(Boolean)));
	let tokenResult: Awaited<ReturnType<typeof verifyIssuedToken>> | { ok: false; reason: 'missing-session' };

	if (!sessionCandidates.length) {
		tokenResult = { ok: false, reason: 'missing-session' };
	} else {
		tokenResult = { ok: false, reason: 'mismatch' } as Awaited<ReturnType<typeof verifyIssuedToken>>;
		for (const sessionId of sessionCandidates) {
			const candidateResult = await verifyIssuedToken(formToken, sessionId, payload.formType, config.formSecret);
			if (candidateResult.ok) {
				tokenResult = candidateResult;
				break;
			}
			if (tokenResult.reason !== 'expired') {
				tokenResult = candidateResult;
			}
		}
	}

	if (!tokenResult.ok) {
		const code = tokenResult.reason === 'expired' ? 'token_expired' : 'token_invalid';
		return resultFor(payload.formType, redirectTo, false, code, 'Please refresh the page and try again.');
	}

	if (!(await guardStore.assertNonceUnused(tokenResult.payload.nonce))) {
		return resultFor(payload.formType, redirectTo, false, 'token_replayed', 'This submission token has already been used.');
	}

	const remoteIp = getRemoteIp(context.request);
	const rateLimitOk = await guardStore.applyRateLimit(remoteIp, payload.email, payload.formType);
	if (!rateLimitOk) {
		return resultFor(payload.formType, redirectTo, false, 'rate_limited', 'Please wait a moment before trying again.');
	}

	const turnstileToken = typeof formData.get('cf-turnstile-response') === 'string' ? String(formData.get('cf-turnstile-response')) : '';
	const turnstileResult = await formsProvider.verifyTurnstileToken(
		turnstileToken,
		remoteIp,
		payload.formType === 'contact' ? 'contact_submit' : 'subscribe_submit',
		runtime,
		config.turnstileSecret,
	);
	if (!turnstileResult.ok) {
		return resultFor(payload.formType, redirectTo, false, 'captcha_failed', 'Please complete the verification challenge and try again.');
	}

	try {
		if (payload.formType === 'contact') {
			await persistContactSubmission(payload, remoteIp, context.request, contactStore);
			if (formsProvider.behavior.contact.requireSmtp && !runtime.smtpEnabled) {
				return resultFor(payload.formType, redirectTo, false, 'config_error', 'SMTP must be configured for this form mode.');
			}
			if (formsProvider.behavior.contact.notifyAdmin) {
				if (!formsProvider.behavior.contact.requireSmtp && !runtime.smtpEnabled) {
					return resultFor(payload.formType, redirectTo, true, 'success', 'Thanks, your submission has been received.');
				}
				try {
					await sendContactEmail(payload, remoteIp, context.request, runtime, config, formsProvider);
				} catch (error) {
					console.warn('Contact notification email failed', error);
				}
			}
		} else {
			if (formsProvider.behavior.subscribe.requireSmtp && !runtime.smtpEnabled) {
				return resultFor(payload.formType, redirectTo, false, 'config_error', 'SMTP must be configured for this form mode.');
			}
			await handleSubscribe(payload, remoteIp, context.request, subscriberStore, runtime, config, formsProvider);
		}
	} catch (error) {
		console.error('Form submission failed', error);
		return resultFor(payload.formType, redirectTo, false, 'delivery_failed', 'The submission could not be delivered right now.');
	}

	return resultFor(payload.formType, redirectTo, true, 'success', 'Thanks, your submission has been received.');
}
