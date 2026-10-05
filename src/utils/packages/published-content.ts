import { getDeployConfig } from '../../runtime/platform/deploy-runtime.ts';
import {
	createTeamScopedR2OverlayContentRuntimeProvider,
	isTeamScopedR2ContentEnabled,
	resolveCloudflareR2Bucket,
	resolvePublishedContentBucketBinding,
	resolveTeamScopedContentLocator,
	type ContentRuntimeProvider,
	type EditorialPreviewTokenPayload,
} from '../../runtime/platform/published-content.ts';
import type { CloudflareRuntime } from '../../types/cloudflare';

function runtimeFromLocals(locals: App.Locals | Record<string, unknown> | undefined | null) {
	return ((locals as App.Locals | undefined)?.runtime ?? null) as CloudflareRuntime | null;
}

function previewFromLocals(locals: App.Locals | Record<string, unknown> | undefined | null) {
	return ((locals as App.Locals | undefined)?.contentPreview ?? null) as EditorialPreviewTokenPayload | null;
}

function runtimeText(runtime: CloudflareRuntime | null, key: string) {
	const value = runtime?.env?.[key];
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function defaultTeamIdForRuntime(locals: App.Locals | Record<string, unknown> | undefined | null) {
	const runtime = runtimeFromLocals(locals);
	const configured = typeof runtime?.env?.TREESEED_CONTENT_DEFAULT_TEAM_ID === 'string'
		? runtime.env.TREESEED_CONTENT_DEFAULT_TEAM_ID.trim()
		: '';
	if (configured) {
		return configured;
	}

	return getDeployConfig().slug;
}

export function resolveHostedContentRuntimeProvider(
	locals: App.Locals | Record<string, unknown> | undefined | null,
): ContentRuntimeProvider | null {
	const deployConfig = getDeployConfig();
	if (!isTeamScopedR2ContentEnabled(deployConfig)) {
		return null;
	}

	const runtime = runtimeFromLocals(locals);
	const bucket = resolveCloudflareR2Bucket(runtime, resolvePublishedContentBucketBinding(deployConfig));
	if (!bucket) {
		return null;
	}

	const defaultTeamId = defaultTeamIdForRuntime(locals);
	const preview = previewFromLocals(locals);
	const locator = resolveTeamScopedContentLocator(
		deployConfig,
		defaultTeamId,
		preview?.teamId === defaultTeamId ? preview.previewId : undefined,
	);
	const manifestKey = runtimeText(runtime, 'TREESEED_CONTENT_MANIFEST_KEY');
	const previewRoot = runtimeText(runtime, 'TREESEED_EDITORIAL_PREVIEW_ROOT');

	return createTeamScopedR2OverlayContentRuntimeProvider({
		bucket,
		locator: {
			...locator,
			...(manifestKey ? { manifestKey } : {}),
			...(previewRoot ? {
				previewRoot,
				overlayKey: preview?.previewId ? `${previewRoot}/${preview.previewId}/overlay.json` : undefined,
			} : {}),
		},
	});
}

export type HostedDocsTreeEntry = {
	id: string;
	slug: string;
	title?: string;
	summary?: string;
	path: string;
};

export async function loadHostedDocsTree(
	locals: App.Locals | Record<string, unknown> | undefined | null,
): Promise<HostedDocsTreeEntry[] | null> {
	const provider = resolveHostedContentRuntimeProvider(locals);
	if (!provider) {
		return null;
	}

	const manifest = await provider.getManifest();
	const pointer = manifest.runtime?.docsTree;
	if (!pointer) {
		return null;
	}

	return provider.getObject<HostedDocsTreeEntry[]>(pointer);
}
