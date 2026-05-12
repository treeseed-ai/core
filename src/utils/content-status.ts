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
		tone: 'border-[color:var(--ts-color-accent)]/35 bg-[color:var(--ts-color-accent-soft)] text-[color:var(--ts-color-accent-strong)]',
	},
	'in progress': {
		label: 'In Progress',
		description: 'Actively being built or hardened.',
		tone: 'border-[color:var(--ts-color-warning-border)] bg-[color:var(--ts-color-warning-soft)] text-[color:var(--ts-color-warning-text)]',
	},
	exploratory: {
		label: 'Exploratory',
		description: 'Directionally important, but still unsettled.',
		tone: 'border-[color:var(--ts-color-info)]/40 bg-[color:var(--ts-color-info-soft)] text-[color:var(--ts-color-info-text)]',
	},
	planned: {
		label: 'Planned',
		description: 'Intended, but not started in a meaningful way.',
		tone: 'border-[color:var(--ts-color-border-strong)] bg-[color:var(--ts-color-surface-muted)] text-[color:var(--ts-color-text-muted)]',
	},
	speculative: {
		label: 'Speculative',
		description: 'Conceptual or long-range, not a current commitment.',
		tone: 'border-[color:var(--ts-color-border)] bg-[color:var(--ts-color-surface-muted)] text-[color:var(--ts-color-text-subtle)]',
	},
};

export const PROJECT_STAGE = {
	label: SITE.projectStage,
	description: SITE.projectStageDetail,
};
