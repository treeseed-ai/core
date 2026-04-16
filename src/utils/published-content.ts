import type { TreeseedBookRuntime } from '@treeseed/sdk/platform/books-data';
import { getTreeseedDeployConfig } from '@treeseed/sdk/platform/plugins';
import {
	createTeamScopedR2OverlayContentRuntimeProvider,
	isTeamScopedR2ContentEnabled,
	resolveCloudflareR2Bucket,
	resolvePublishedContentBucketBinding,
	resolveTeamScopedContentLocator,
	type ContentRuntimeProvider,
	type EditorialPreviewTokenPayload,
} from '@treeseed/sdk/platform/published-content';
import type { CloudflareRuntime } from '../types/cloudflare';

function runtimeFromLocals(locals: App.Locals | Record<string, unknown> | undefined | null) {
	return ((locals as App.Locals | undefined)?.runtime ?? null) as CloudflareRuntime | null;
}

function previewFromLocals(locals: App.Locals | Record<string, unknown> | undefined | null) {
	return ((locals as App.Locals | undefined)?.contentPreview ?? null) as EditorialPreviewTokenPayload | null;
}

function defaultTeamIdForRuntime(locals: App.Locals | Record<string, unknown> | undefined | null) {
	const runtime = runtimeFromLocals(locals);
	const configured = typeof runtime?.env?.TREESEED_CONTENT_DEFAULT_TEAM_ID === 'string'
		? runtime.env.TREESEED_CONTENT_DEFAULT_TEAM_ID.trim()
		: '';
	if (configured) {
		return configured;
	}

	return getTreeseedDeployConfig().slug;
}

export function resolveHostedContentRuntimeProvider(
	locals: App.Locals | Record<string, unknown> | undefined | null,
): ContentRuntimeProvider | null {
	const deployConfig = getTreeseedDeployConfig();
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

	return createTeamScopedR2OverlayContentRuntimeProvider({
		bucket,
		locator,
	});
}

export async function loadHostedBookRuntime(
	locals: App.Locals | Record<string, unknown> | undefined | null,
): Promise<TreeseedBookRuntime | null> {
	const provider = resolveHostedContentRuntimeProvider(locals);
	if (!provider) {
		return null;
	}

	const manifest = await provider.getManifest();
	const pointer = manifest.runtime?.booksRuntime;
	if (!pointer) {
		return null;
	}

	return provider.getObject<TreeseedBookRuntime>(pointer);
}
