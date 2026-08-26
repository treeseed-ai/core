import { createHmac, timingSafeEqual } from 'node:crypto';
import type { DeployConfig } from '@treeseed/sdk/site-contracts/platform';
import type { CloudflareRuntime, R2BucketLike } from '@treeseed/sdk/site-contracts/cloudflare';

export const EDITORIAL_PREVIEW_COOKIE = 'treeseed-content-preview';

export interface EditorialPreviewTokenPayload { teamId: string; previewId: string; expiresAt: string }
export interface PublishedContentObjectPointer { objectKey: string; sha256?: string }
export interface PublishedContentEntry {
	id: string; model: string; slug: string; title?: string; summary?: string; status?: string;
	publishedAt?: string; updatedAt?: string; content: PublishedContentObjectPointer; [key: string]: unknown;
}
export interface PublishedContentManifest {
	entries: PublishedContentEntry[];
	runtime?: { docsTree?: PublishedContentObjectPointer; searchIndex?: PublishedContentObjectPointer; [key: string]: unknown };
	[key: string]: unknown;
}
export interface ContentRuntimeProvider {
	getManifest(): Promise<PublishedContentManifest>;
	listCollection(model: string): Promise<PublishedContentEntry[]>;
	getEntry(model: string, slugOrId: string): Promise<PublishedContentEntry | null>;
	getObject<T>(pointer: PublishedContentObjectPointer): Promise<T | null>;
}

function signature(payload: string, secret: string) {
	return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function signEditorialPreviewToken(payload: EditorialPreviewTokenPayload, secret: string) {
	const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
	return `${encoded}.${signature(encoded, secret)}`;
}

export function verifyEditorialPreviewToken(token: string, secret: string): EditorialPreviewTokenPayload | null {
	try {
		const [payload, provided] = token.split('.');
		if (!payload || !provided) return null;
		const expected = signature(payload, secret);
		if (provided.length !== expected.length || !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return null;
		const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as EditorialPreviewTokenPayload;
		if (!parsed.teamId || !parsed.previewId || !parsed.expiresAt || Date.parse(parsed.expiresAt) <= Date.now()) return null;
		return parsed;
	} catch { return null }
}

export function isTeamScopedR2ContentEnabled(config: DeployConfig) {
	return config.providers?.content?.runtime === 'team_scoped_r2_overlay';
}

export function resolvePublishedContentBucketBinding(config: DeployConfig) {
	return process.env.TREESEED_CONTENT_BUCKET_BINDING?.trim() || config.cloudflare?.r2?.binding || 'TREESEED_CONTENT_BUCKET';
}

export function resolveCloudflareR2Bucket(runtime: CloudflareRuntime | null | undefined, binding: string): R2BucketLike | null {
	const candidate = runtime?.env?.[binding];
	return candidate && typeof candidate === 'object' ? candidate as R2BucketLike : null;
}

function expand(template: string, values: Record<string, string>) {
	return template.replace(/\{([A-Za-z]+)\}/gu, (_match, key: string) => values[key] ?? key);
}

export function resolveTeamScopedContentLocator(config: DeployConfig, teamId: string, previewId?: string) {
	const values = { teamId, projectId: config.slug ?? 'admin', environment: process.env.TREESEED_ENVIRONMENT ?? 'staging', previewId: previewId ?? '' };
	const manifestTemplate = config.cloudflare?.r2?.manifestKeyTemplate ?? 'teams/{teamId}/published/common.json';
	const previewTemplate = config.cloudflare?.r2?.previewRootTemplate ?? 'teams/{teamId}/previews';
	return {
		manifestKey: expand(manifestTemplate, values),
		previewRoot: expand(previewTemplate, values),
		overlayKey: previewId ? `${expand(previewTemplate, values)}/${previewId}/overlay.json` : undefined,
	};
}

export function createTeamScopedR2OverlayContentRuntimeProvider(input: {
	bucket: R2BucketLike;
	locator: { manifestKey: string; overlayKey?: string };
}): ContentRuntimeProvider {
	let manifestPromise: Promise<PublishedContentManifest> | null = null;
	const getManifest = () => manifestPromise ??= input.bucket.get(input.locator.manifestKey).then(async (object) => {
		if (!object) throw new Error(`Published content manifest is unavailable at ${input.locator.manifestKey}.`);
		return object.json<PublishedContentManifest>();
	});
	return {
		getManifest,
		async listCollection(model) { return (await getManifest()).entries.filter((entry) => entry.model === model) },
		async getEntry(model, slugOrId) { return (await getManifest()).entries.find((entry) => entry.model === model && (entry.slug === slugOrId || entry.id === slugOrId)) ?? null },
		async getObject<T>(pointer: PublishedContentObjectPointer) { const object = await input.bucket.get(pointer.objectKey); return object ? object.json<T>() : null },
	};
}
