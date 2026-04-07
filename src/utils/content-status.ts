import { SITE } from './site-config';

export const CONTENT_STATUSES = ['live', 'in progress', 'exploratory', 'planned', 'speculative'] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const CONTENT_STATUS_META: Record<
	ContentStatus,
	{ label: string; description: string; tone: string }
> = {
	live: {
		label: 'Live',
		description: 'Materially exists and is maintained.',
		tone: 'border-[color:var(--site-accent)]/35 bg-[color:var(--site-accent-soft)] text-[color:var(--site-accent-strong)]',
	},
	'in progress': {
		label: 'In Progress',
		description: 'Actively being built or hardened.',
		tone: 'border-[color:var(--site-warm)]/40 bg-[color:rgba(215,176,123,0.18)] text-[color:var(--site-warm-strong)]',
	},
	exploratory: {
		label: 'Exploratory',
		description: 'Directionally important, but still unsettled.',
		tone: 'border-[color:var(--site-blue)]/40 bg-[color:var(--site-blue-soft)] text-[color:var(--site-blue-strong)]',
	},
	planned: {
		label: 'Planned',
		description: 'Intended, but not started in a meaningful way.',
		tone: 'border-[color:#9c9277]/35 bg-[color:rgba(156,146,119,0.14)] text-[color:#5f5743]',
	},
	speculative: {
		label: 'Speculative',
		description: 'Conceptual or long-range, not a current commitment.',
		tone: 'border-[color:#a39b8e]/35 bg-[color:rgba(163,155,142,0.14)] text-[color:#4d4638]',
	},
};

export const PROJECT_STAGE = {
	label: SITE.projectStage,
	description: SITE.projectStageDetail,
};
