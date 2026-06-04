import { getCollection } from 'astro:content';
import { normalizeTemplateLaunchRequirements } from '@treeseed/sdk/template-launch-requirements';
import type { TemplateLaunchRequirements } from '@treeseed/sdk/template-launch-requirements';
import type { CatalogItem, CatalogItemOfferMode } from '@treeseed/sdk/types';
import { RUNTIME_TENANT } from './tenant/runtime-config.ts';
import { siteModelRendered } from './utils/site-models.ts';

export interface TemplateContentEntry {
	id: string;
	data: {
		slug: string;
		title: string;
		summary: string;
		description: string;
		status: string;
		category: string;
		featured?: boolean;
		publisher: {
			name: string;
		};
		templateVersion: string;
		templateApiVersion: number;
		minCliVersion: string;
		minCoreVersion: string;
		offer?: {
			priceModel?: CatalogItemOfferMode | string;
		};
		fulfillment: {
			mode?: string;
			source:
				| {
					kind: 'git';
					repoUrl: string;
					directory: string;
					ref: string;
				}
				| {
					kind: 'r2';
					objectKey: string;
					version: string;
					publicUrl?: string;
				};
			hooksPolicy?: string;
			supportsReconcile?: boolean;
		};
	};
	[key: string]: unknown;
}

export interface TemplateCatalogProviderContext {
	locals?: object | null | undefined;
}

export interface TemplateCatalogProvider {
	listItems?(context: TemplateCatalogProviderContext): Promise<CatalogItem[]>;
	getItemBySlug?(slug: string, context: TemplateCatalogProviderContext): Promise<CatalogItem | null>;
}

export interface TemplateSiteCard {
	slug: string;
	title: string;
	summary: string;
	category: string;
	featured: boolean;
	publisherName: string;
	templateVersion?: string;
	priceModel?: CatalogItemOfferMode | string;
	source: 'catalog' | 'content';
	launchRequirements?: TemplateLaunchRequirements;
}

export interface TemplateSiteDetail extends TemplateSiteCard {
	description: string;
	compatibility: {
		templateVersion?: string;
		templateApiVersion?: number | string;
		minCliVersion?: string;
		minCoreVersion?: string;
	};
	fulfillment: {
		mode: string;
		sourceLabel: string;
		artifactKey?: string | null;
		manifestKey?: string | null;
		repoUrl?: string;
		directory?: string;
		ref?: string;
		objectKey?: string;
		version?: string;
		publicUrl?: string;
		hooksPolicy?: string | null;
		supportsReconcile?: boolean | null;
	};
	contentEntry: TemplateContentEntry | null;
	catalogItem: CatalogItem | null;
}

type TemplateSourceOptions = TemplateCatalogProviderContext & {
	catalogProvider?: TemplateCatalogProvider | null;
	listLocalEntries?: (() => Promise<TemplateContentEntry[]>) | null;
};

export interface TemplateSiteListingResult {
	rendered: boolean;
	items: TemplateSiteCard[];
}

export interface ResolvedSiteTemplateResult {
	rendered: boolean;
	item: TemplateSiteDetail | null;
}

function sortTemplateCards<T extends { featured?: boolean; title?: string }>(entries: T[]) {
	return [...entries].sort((left, right) => {
		const featuredDelta = Number(Boolean(right.featured)) - Number(Boolean(left.featured));
		if (featuredDelta !== 0) {
			return featuredDelta;
		}
		return String(left.title ?? '').localeCompare(String(right.title ?? ''), undefined, { sensitivity: 'base' });
	});
}

async function listLocalTemplateEntries(listLocalEntries?: (() => Promise<TemplateContentEntry[]>) | null) {
	if (typeof listLocalEntries === 'function') {
		return listLocalEntries();
	}
	if (!RUNTIME_TENANT.content.templates) {
		return [];
	}
	return getCollection('templates') as Promise<TemplateContentEntry[]>;
}

function catalogString(metadata: Record<string, unknown> | undefined, key: string) {
	const value = metadata?.[key];
	return typeof value === 'string' && value.trim() ? value : undefined;
}

function catalogNumber(metadata: Record<string, unknown> | undefined, key: string) {
	const value = metadata?.[key];
	return typeof value === 'number' ? value : undefined;
}

function catalogLaunchRequirements(metadata: Record<string, unknown> | undefined, label: string) {
	return normalizeTemplateLaunchRequirements(metadata?.launchRequirements, `${label} launchRequirements`);
}

function contentCardFromEntry(entry: TemplateContentEntry): TemplateSiteCard | null {
	if (entry.data.status !== 'live') {
		return null;
	}
	return {
		slug: entry.data.slug,
		title: entry.data.title,
		summary: entry.data.summary,
		category: entry.data.category,
		featured: entry.data.featured === true,
		publisherName: entry.data.publisher.name,
		templateVersion: entry.data.templateVersion,
		priceModel: entry.data.offer?.priceModel,
		source: 'content',
		launchRequirements: undefined,
	};
}

function detailFromContentEntry(entry: TemplateContentEntry): TemplateSiteDetail {
	const source = entry.data.fulfillment.source;
	return {
		...contentCardFromEntry(entry)!,
		description: entry.data.description,
		compatibility: {
			templateVersion: entry.data.templateVersion,
			templateApiVersion: entry.data.templateApiVersion,
			minCliVersion: entry.data.minCliVersion,
			minCoreVersion: entry.data.minCoreVersion,
		},
		fulfillment: source.kind === 'r2'
			? {
				mode: entry.data.fulfillment.mode ?? 'r2',
				sourceLabel: 'R2 artifact',
				objectKey: source.objectKey,
				version: source.version,
				publicUrl: source.publicUrl,
				hooksPolicy: entry.data.fulfillment.hooksPolicy,
				supportsReconcile: entry.data.fulfillment.supportsReconcile,
			}
			: {
				mode: entry.data.fulfillment.mode ?? 'git',
				sourceLabel: 'Git',
				repoUrl: source.repoUrl,
				directory: source.directory,
				ref: source.ref,
				hooksPolicy: entry.data.fulfillment.hooksPolicy,
				supportsReconcile: entry.data.fulfillment.supportsReconcile,
			},
		contentEntry: entry,
		catalogItem: null,
	};
}

function cardFromCatalogItem(item: CatalogItem): TemplateSiteCard {
	return {
		slug: item.slug,
		title: item.title,
		summary: item.summary ?? '',
		category: catalogString(item.metadata, 'category') ?? 'Template',
		featured: item.metadata?.featured === true,
		publisherName: catalogString(item.metadata, 'publisherName') ?? item.teamId,
		templateVersion: catalogString(item.metadata, 'templateVersion'),
		priceModel: item.offerMode,
		source: 'catalog',
		launchRequirements: catalogLaunchRequirements(item.metadata, `catalog item ${item.slug}`),
	};
}

function detailFromCatalogItem(item: CatalogItem): TemplateSiteDetail {
	return {
		...cardFromCatalogItem(item),
		description: item.summary ?? 'This template is managed through the central market catalog.',
		compatibility: {
			templateVersion: catalogString(item.metadata, 'templateVersion'),
			templateApiVersion: catalogNumber(item.metadata, 'templateApiVersion'),
			minCliVersion: catalogString(item.metadata, 'minCliVersion'),
			minCoreVersion: catalogString(item.metadata, 'minCoreVersion'),
		},
		fulfillment: {
			mode: catalogString(item.metadata, 'fulfillmentMode') ?? 'r2',
			sourceLabel: item.artifactKey ? 'R2 artifact' : 'Catalog metadata',
			artifactKey: item.artifactKey,
			manifestKey: item.manifestKey,
		},
		contentEntry: null,
		catalogItem: item,
	};
}

async function selectCatalogItemBySlug(
	slug: string,
	context: TemplateSourceOptions,
) {
	if (!context.catalogProvider) {
		return null;
	}
	if (typeof context.catalogProvider.getItemBySlug === 'function') {
		return context.catalogProvider.getItemBySlug(slug, { locals: context.locals });
	}
	if (typeof context.catalogProvider.listItems === 'function') {
		const items = await context.catalogProvider.listItems({ locals: context.locals });
		return items.find((item) => item.slug === slug) ?? null;
	}
	return null;
}

export async function listSiteTemplates(context: TemplateSourceOptions = {}): Promise<TemplateSiteListingResult> {
	if (!siteModelRendered('templates')) {
		return {
			rendered: false,
			items: [] as TemplateSiteCard[],
		};
	}

	const catalogItems = context.catalogProvider && typeof context.catalogProvider.listItems === 'function'
		? await context.catalogProvider.listItems({ locals: context.locals })
		: [];
	const localEntries = await listLocalTemplateEntries(context.listLocalEntries);
	const cardsBySlug = new Map<string, TemplateSiteCard>();
	for (const entry of localEntries) {
		const card = contentCardFromEntry(entry);
		if (card) {
			cardsBySlug.set(card.slug, card);
		}
	}
	for (const item of catalogItems) {
		const card = cardFromCatalogItem(item);
		const existing = cardsBySlug.get(card.slug);
		if (existing) {
			cardsBySlug.set(card.slug, {
				...existing,
				launchRequirements: existing.launchRequirements ?? card.launchRequirements,
			});
		} else {
			cardsBySlug.set(card.slug, card);
		}
	}
	return {
		rendered: true,
		items: sortTemplateCards([...cardsBySlug.values()]),
	};
}

export async function resolveSiteTemplate(
	slug: string,
	context: TemplateSourceOptions = {},
): Promise<ResolvedSiteTemplateResult> {
	if (!siteModelRendered('templates')) {
		return {
			rendered: false,
			item: null as TemplateSiteDetail | null,
		};
	}

	const entries = await listLocalTemplateEntries(context.listLocalEntries);
	const entry = entries.find((candidate) => candidate.data.slug === slug && candidate.data.status === 'live') ?? null;
	if (entry) {
		return {
			rendered: true,
			item: detailFromContentEntry(entry),
		};
	}

	const catalogItem = await selectCatalogItemBySlug(slug, context);
	return {
		rendered: true,
		item: catalogItem ? detailFromCatalogItem(catalogItem) : null,
	};
}
