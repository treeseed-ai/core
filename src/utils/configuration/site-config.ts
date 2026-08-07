import { RUNTIME_SITE_CONFIG, RUNTIME_TENANT } from '../../tenant/runtime-config';
import { buildThemeCss } from '../support/theme.ts';

function requireRuntimeSiteConfig() {
	if (!RUNTIME_SITE_CONFIG) {
		throw new Error(
			`Treeseed runtime site config was not injected for tenant config at "${RUNTIME_TENANT.siteConfigPath}".`,
		);
	}

	return RUNTIME_SITE_CONFIG;
}

export const SITE_CONFIG = requireRuntimeSiteConfig();

export const SITE = {
	logo: SITE_CONFIG.site.logo,
	name: SITE_CONFIG.site.name,
	statement: SITE_CONFIG.site.statement,
	description: SITE_CONFIG.site.summary,
	summary: SITE_CONFIG.site.summary,
	url: SITE_CONFIG.site.siteUrl,
	githubRepository: SITE_CONFIG.site.githubRepository,
	discordLink: SITE_CONFIG.site.discordLink,
	projectStage: SITE_CONFIG.site.projectStage,
	projectStageDetail: SITE_CONFIG.site.projectStageDetail,
	theme: SITE_CONFIG.site.theme,
	headerMenu: SITE_CONFIG.site.headerMenu,
	footerMenu: SITE_CONFIG.site.footerMenu,
	forms: SITE_CONFIG.site.forms,
	emailNotifications: SITE_CONFIG.site.emailNotifications,
};

export const SITE_HEADER_MENU = SITE.headerMenu;
export const SITE_FOOTER_MENU = SITE.footerMenu;
export const SITE_FORMS = SITE.forms;
export const SITE_EMAIL_NOTIFICATIONS = SITE.emailNotifications;
export const SITE_THEME_CSS = buildThemeCss(SITE.theme);

export const PAGE_MODEL_DEFAULTS = SITE_CONFIG.models.pages.defaults;
export const NOTE_MODEL_DEFAULTS = SITE_CONFIG.models.notes.defaults;
export const QUESTION_MODEL_DEFAULTS = SITE_CONFIG.models.questions.defaults;
export const OBJECTIVE_MODEL_DEFAULTS = SITE_CONFIG.models.objectives.defaults;
export const PROPOSAL_MODEL_DEFAULTS = SITE_CONFIG.models.proposals.defaults;
export const DECISION_MODEL_DEFAULTS = SITE_CONFIG.models.decisions.defaults;
export const PEOPLE_MODEL_DEFAULTS = SITE_CONFIG.models.people.defaults;
export const AGENT_MODEL_DEFAULTS = SITE_CONFIG.models.agents.defaults;
export const BOOK_MODEL_DEFAULTS = SITE_CONFIG.models.books.defaults;
export const MODEL_DEFAULTS = SITE_CONFIG.models.docs.defaults;

export function applyPageModelDefaults<
	T extends Partial<{
		pageLayout: string;
		status: string;
		stage: string;
		audience: string[];
	}>,
>(value: T) {
	return {
		...PAGE_MODEL_DEFAULTS,
		...value,
		audience: value.audience ?? PAGE_MODEL_DEFAULTS.audience ?? [],
	};
}

export function applyNoteModelDefaults<
	T extends Partial<{
		author: string;
		draft: boolean;
		groupIds: string[];
		status: string;
	}>,
>(value: T) {
	return {
		...NOTE_MODEL_DEFAULTS,
		...value,
		groupIds: value.groupIds ?? NOTE_MODEL_DEFAULTS.groupIds ?? [],
	};
}

export function applyQuestionModelDefaults<
	T extends Partial<{
		draft: boolean;
		groupIds: string[];
		status: string;
	}>,
>(value: T) {
	return {
		...QUESTION_MODEL_DEFAULTS,
		...value,
		groupIds: value.groupIds ?? QUESTION_MODEL_DEFAULTS.groupIds ?? [],
	};
}

export function applyObjectiveModelDefaults<
	T extends Partial<{
		draft: boolean;
		groupIds: string[];
		status: string;
	}>,
>(value: T) {
	return {
		...OBJECTIVE_MODEL_DEFAULTS,
		...value,
		groupIds: value.groupIds ?? OBJECTIVE_MODEL_DEFAULTS.groupIds ?? [],
	};
}

export function applyProposalModelDefaults<
	T extends Partial<{
		draft: boolean;
		groupIds: string[];
		status: string;
	}>,
>(value: T) {
	return {
		...PROPOSAL_MODEL_DEFAULTS,
		...value,
		groupIds: value.groupIds ?? PROPOSAL_MODEL_DEFAULTS.groupIds ?? [],
	};
}

export function applyDecisionModelDefaults<
	T extends Partial<{
		draft: boolean;
		groupIds: string[];
		status: string;
	}>,
>(value: T) {
	return {
		...DECISION_MODEL_DEFAULTS,
		...value,
		groupIds: value.groupIds ?? DECISION_MODEL_DEFAULTS.groupIds ?? [],
	};
}

export function applyPeopleModelDefaults<
	T extends Partial<{
		status: string;
		groupIds: string[];
	}>,
>(value: T) {
	return {
		...PEOPLE_MODEL_DEFAULTS,
		...value,
		groupIds: value.groupIds ?? PEOPLE_MODEL_DEFAULTS.groupIds ?? [],
	};
}

export function applyAgentModelDefaults<
	T extends Partial<{
		runtimeStatus: string;
		groupIds: string[];
	}>,
>(value: T) {
	return {
		...AGENT_MODEL_DEFAULTS,
		...value,
		groupIds: value.groupIds ?? AGENT_MODEL_DEFAULTS.groupIds ?? [],
	};
}

export function applyBookModelDefaults<T extends Partial<{ groupIds: string[] }>>(value: T) {
	return {
		...BOOK_MODEL_DEFAULTS,
		...value,
		groupIds: value.groupIds ?? BOOK_MODEL_DEFAULTS.groupIds ?? [],
	};
}

export function applyDocsModelDefaults<T extends Partial<{ groupIds: string[] }>>(value: T) {
	return {
		...MODEL_DEFAULTS,
		...value,
		groupIds: value.groupIds ?? MODEL_DEFAULTS.groupIds ?? [],
	};
}
