import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { packageRoot } from "../packages/package-tools.ts";
import { COPY_EXTENSIONS, JS_SOURCE_EXTENSIONS, compileModule, copyAsset, copyPackageAsset, distRoot, require, rewriteDeclarations, scriptsRoot, srcRoot, transpileScript, walkFiles } from './build-runtime.ts';
import { compileVendorPackage, emitTypeDeclarations, patchRuntime, patchVendoredStarlight, rewriteStarlightSpecifiers, writeCompatibilityEntrypoint } from './resolve-workspace-sdk-declaration-paths.ts';

export async function main() {
	rmSync(distRoot, { recursive: true, force: true });
	mkdirSync(distRoot, { recursive: true });

	for (const filePath of walkFiles(srcRoot)) {
		if (filePath.endsWith('.d.ts')) {
			copyAsset(filePath, srcRoot, distRoot);
			continue;
		}

		const extension = extname(filePath);
		if (JS_SOURCE_EXTENSIONS.has(extension)) {
			await compileModule(filePath, srcRoot, distRoot);
			continue;
		}

		if (COPY_EXTENSIONS.has(extension)) {
			copyAsset(filePath, srcRoot, distRoot);
		}
	}

	for (const filePath of walkFiles(scriptsRoot)) {
		const extension = extname(filePath);
		if (JS_SOURCE_EXTENSIONS.has(extension)) {
			transpileScript(filePath);
		}
	}

	emitTypeDeclarations();


	const starlightPackageRoot = dirname(require.resolve('@astrojs/starlight'));
	const vendoredStarlightRoot = resolve(distRoot, 'vendor', 'starlight');
	await compileVendorPackage(starlightPackageRoot, vendoredStarlightRoot);
	patchVendoredStarlight(vendoredStarlightRoot);
	patchRuntime(distRoot);

	for (const filePath of walkFiles(distRoot)) {
		if (filePath.startsWith(`${vendoredStarlightRoot}/`) || filePath === vendoredStarlightRoot) continue;
		if (!(filePath.endsWith('.astro') || filePath.endsWith('.js'))) continue;
		const contents = readFileSync(filePath, 'utf8');
		writeFileSync(filePath, rewriteStarlightSpecifiers(contents, filePath), 'utf8');
	}

	writeCompatibilityEntrypoint(
		resolve(distRoot, 'config.js'),
		"import starlight from './vendor/starlight/index.js';\nimport { loadManifest } from './runtime/platform/tenant-config.js';\nimport { createSite } from './support/site.js';\n\nexport function createTenantSite(manifestPath) {\n\tconst tenant = loadManifest(manifestPath);\n\treturn createSite(tenant, { starlight });\n}"
	);
	writeCompatibilityEntrypoint(
		resolve(distRoot, 'config.d.ts'),
		"export declare function createTenantSite(manifestPath?: string): import('astro').AstroUserConfig<never, never, never>;"
	);

	writeCompatibilityEntrypoint(
		resolve(distRoot, 'content.d.ts'),
		"export declare function createCollections(tenantConfig: any, dependencies: any): Record<string, any>;"
	);

	writeCompatibilityEntrypoint(
		resolve(distRoot, 'content-config.js'),
		"import { loadManifest } from './runtime/platform/tenant-config.js';\nimport { docsLoader } from './vendor/starlight/loaders.js';\nimport { docsSchema } from './vendor/starlight/schema.js';\nimport { createCollections } from './content/content.js';\n\nexport function createTenantCollections(manifestPath) {\n\tconst tenant = loadManifest(manifestPath);\n\treturn createCollections(tenant, { docsLoader, docsSchema });\n}"
	);
	writeCompatibilityEntrypoint(
		resolve(distRoot, 'content-config.d.ts'),
		"export declare function createTenantCollections(manifestPath?: string): {\n\tpages: any;\n\tnotes: any;\n\tquestions: any;\n\tobjectives: any;\n\tpeople: any;\n\tagents: any;\n\tagent_tests?: any;\n\tbooks: any;\n\tdocs: any;\n\tworkdays?: any;\n};"
	);
	writeCompatibilityEntrypoint(
		resolve(distRoot, 'utils/forms/service.d.ts'),
		"import type { APIContext } from 'astro';\nimport type { SubmitResult } from '../../types/forms';\nexport declare function handleTokenRequest(context: APIContext): Promise<Response>;\nexport declare function handleFormSubmission(context: APIContext): Promise<SubmitResult>;"
	);
	rmSync(resolve(distRoot, 'config.d.js'), { force: true });
	rmSync(resolve(distRoot, 'content-config.d.js'), { force: true });

	writeCompatibilityEntrypoint(
		resolve(vendoredStarlightRoot, 'utils', 'routing.js'),
		"export * from './routing/index.js';"
	);

	copyAsset(resolve(packageRoot, 'tsconfigs/strict.json'), packageRoot, distRoot);
	copyPackageAsset('@astrojs/mdx', 'template/content-module-types.d.ts', 'template/content-module-types.d.ts');
	copyPackageAsset('@astrojs/mdx', 'dist/server.js', 'dist/server.js');
	copyPackageAsset('@astrojs/starlight', 'style/anchor-links.css', 'style/anchor-links.css');
	copyPackageAsset('@astrojs/starlight', 'utils/git.ts', 'utils/git.ts');
	copyPackageAsset('@astrojs/starlight', 'utils/gitInlined.ts', 'utils/gitInlined.ts');
	rewriteDeclarations();
	const marker = resolve(distRoot, '.treeseed-build-complete.json'), temporary = `${marker}.new`;
	writeFileSync(temporary, `${JSON.stringify({ completedAt: new Date().toISOString() })}\n`, 'utf8');
	renameSync(temporary, marker);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
