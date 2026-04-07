import type { ContactType } from '../../types/forms';

export const FORM_SESSION_COOKIE = 'karyon_form_session';
export const FORM_TOKEN_TTL_MS = 30 * 60 * 1000;
export const NONCE_TTL_SECONDS = 60 * 60;
export const RATE_LIMIT_TTL_SECONDS = 10 * 60;
export const RATE_LIMIT_MAX_ATTEMPTS = 3;
export const HONEYPOT_FIELD = 'website';
export const FORM_SUCCESS_PARAM = 'formStatus';
export const FORM_CODE_PARAM = 'formCode';
export const SUBSCRIBE_ANCHOR_ID = 'site-subscribe';

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
	question: 'Question',
	feedback: 'Feedback',
	collaboration: 'Collaboration',
	issue: 'Report Issue',
};
