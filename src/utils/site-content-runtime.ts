import { createMarkdownProcessor, type MarkdownProcessor } from '@astrojs/markdown-remark';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import type { TreeseedContentCollection } from '@treeseed/sdk/platform/contracts';
import { getTreeseedContentServingMode } from '@treeseed/sdk/platform/deploy-runtime';
import type { ContentRuntimeProvider, PublishedContentEntry } from '@treeseed/sdk/platform/published-content';
import { resolveHostedContentRuntimeProvider } from './published-content.ts';

export type PublishedContentSourcePayload = {
	model: string;
	id: string;
	slug: string;
	title?: string;
	summary?: string;
	status?: string;
	visibility?: string;
	frontmatter?: Record<string, unknown>;
	body?: string;
	relativePath?: string;
	filePath?: string;
	updatedAt?: string;
};

export type RuntimeHubEntry<T = Record<string, unknown>> = {
	id: string;
	model: string;
	slug: string;
	data: T;
};

export type RuntimeReferenceEntry = RuntimeHubEntry<{
	title?: string;
	name?: string;
}>;

let markdownProcessorPromise: Promise<MarkdownProcessor> | null = null;

function markdownProcessor() {
	if (!markdownProcessorPromise) {
		markdownProcessorPromise = createMarkdownProcessor({
			remarkPlugins: [remarkMath],
			rehypePlugins: [[rehypeKatex, { strict: 'ignore' }]],
		});
	}

	return markdownProcessorPromise;
}

function providerForLocals(locals: App.Locals | Record<string, unknown> | undefined | null) {
	return resolveHostedContentRuntimeProvider(locals) as ContentRuntimeProvider | null;
}

function record(value: unknown): Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function strings(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value
			.map((entry) => typeof entry === 'string' ? entry.trim() : '')
			.filter(Boolean);
	}
	if (typeof value === 'string' && value.trim()) {
		return [value.trim()];
	}
	return [];
}

function dateValue(value: unknown) {
	if (value instanceof Date && Number.isFinite(value.valueOf())) {
		return value;
	}
	if (typeof value === 'string' && value.trim()) {
		const parsed = new Date(value);
		if (Number.isFinite(parsed.valueOf())) {
			return parsed;
		}
	}
	return null;
}

function normalizeTags(value: unknown) {
	return Array.isArray(value)
		? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
		: [];
}

function normalizeLinks(value: unknown) {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.map((entry) => record(entry))
		.map((entry) => ({
			label: typeof entry.label === 'string' ? entry.label : '',
			href: typeof entry.href === 'string' ? entry.href : '',
		}))
		.filter((entry) => entry.label && entry.href);
}

export function normalizePublishedEntry<T = Record<string, unknown>>(
	entry: PublishedContentEntry,
	content: PublishedContentSourcePayload | null | undefined,
) {
	const frontmatter = record(content?.frontmatter);
	const data: Record<string, unknown> = {
		...frontmatter,
		title: typeof frontmatter.title === 'string' ? frontmatter.title : entry.title,
		summary: typeof frontmatter.summary === 'string' ? frontmatter.summary : entry.summary,
		status: typeof frontmatter.status === 'string' ? frontmatter.status : entry.status,
		slug: typeof frontmatter.slug === 'string' ? frontmatter.slug : entry.slug,
		tags: normalizeTags(frontmatter.tags),
		links: normalizeLinks(frontmatter.links),
	};

	const date = dateValue(frontmatter.date ?? entry.publishedAt);
	if (date) {
		data.date = date;
	}

	const updated = dateValue(content?.updatedAt ?? frontmatter.updated ?? entry.updatedAt);
	if (updated) {
		data.updated = updated;
	}

	return {
		id: entry.id,
		model: entry.model,
		slug: entry.slug,
		data: data as T,
	} satisfies RuntimeHubEntry<T>;
}

export function isPublishedRuntimeContentMode() {
	return getTreeseedContentServingMode() === 'published_runtime';
}

export async function renderPublishedMarkdown(body: string) {
	const rendered = await (await markdownProcessor()).render(body ?? '', {
		frontmatter: {},
	});
	return rendered.code;
}

export async function loadPublishedCollection(
	locals: App.Locals | Record<string, unknown> | undefined | null,
	model: TreeseedContentCollection,
) {
	const provider = providerForLocals(locals);
	if (!provider) {
		return [];
	}

	const entries = await provider.listCollection(model);
	const resolved = await Promise.all(entries.map(async (entry) => {
		const content = await provider.getObject<PublishedContentSourcePayload>(entry.content);
		return normalizePublishedEntry(entry, content);
	}));
	return resolved;
}

export async function loadPublishedEntry(
	locals: App.Locals | Record<string, unknown> | undefined | null,
	model: TreeseedContentCollection,
	slugOrId: string,
) {
	const provider = providerForLocals(locals);
	if (!provider) {
		return null;
	}

	const entry = await provider.getEntry(model, slugOrId);
	if (!entry) {
		return null;
	}

	const content = await provider.getObject<PublishedContentSourcePayload>(entry.content);
	if (!content) {
		return null;
	}

	return {
		publishedEntry: entry,
		entry: normalizePublishedEntry(entry, content),
		content,
		html: await renderPublishedMarkdown(content.body ?? ''),
	};
}

export async function resolvePublishedReferences(
	locals: App.Locals | Record<string, unknown> | undefined | null,
	model: TreeseedContentCollection,
	references: unknown,
) {
	const provider = providerForLocals(locals);
	if (!provider) {
		return [];
	}

	const resolved = await Promise.all(strings(references).map(async (slugOrId) => {
		const entry = await provider.getEntry(model, slugOrId);
		if (!entry) {
			return null;
		}
		const content = await provider.getObject<PublishedContentSourcePayload>(entry.content);
		return normalizePublishedEntry(entry, content);
	}));
	return resolved.filter(Boolean) as RuntimeReferenceEntry[];
}

export async function resolvePublishedContributor(
	locals: App.Locals | Record<string, unknown> | undefined | null,
	reference: unknown,
) {
	const provider = providerForLocals(locals);
	if (!provider) {
		return null;
	}

	for (const model of ['people', 'agents'] as const) {
		for (const slugOrId of strings(reference)) {
			const entry = await provider.getEntry(model, slugOrId);
			if (entry) {
				const content = await provider.getObject<PublishedContentSourcePayload>(entry.content);
				return normalizePublishedEntry(entry, content);
			}
		}
	}

	return null;
}

export function metadataFromPublishedContent(content: PublishedContentSourcePayload | null | undefined) {
	return record(content?.frontmatter);
}

export function publishedDate(content: PublishedContentSourcePayload | null | undefined, ...fallbacks: unknown[]) {
	for (const candidate of [content?.frontmatter?.date, ...fallbacks]) {
		const parsed = dateValue(candidate);
		if (parsed) {
			return parsed;
		}
	}
	return new Date(0);
}

export function publishedUpdated(content: PublishedContentSourcePayload | null | undefined, ...fallbacks: unknown[]) {
	for (const candidate of [content?.updatedAt, content?.frontmatter?.updated, ...fallbacks]) {
		const parsed = dateValue(candidate);
		if (parsed) {
			return parsed;
		}
	}
	return new Date(0);
}
