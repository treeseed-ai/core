import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { packageRoot } from ".././package-tools.ts";
import { COPY_EXTENSIONS, JS_SOURCE_EXTENSIONS, compileModule, copyAsset, copyPackageAsset, distRoot, require, rewriteDeclarations, scriptsRoot, srcRoot, transpileScript, walkFiles } from './require.ts';
import { compileVendorPackage, emitTypeDeclarations, patchTreeseedRuntime, patchVendoredStarlight, rewriteTreeseedStarlightSpecifiers, writeCompatibilityEntrypoint } from './resolve-workspace-sdk-declaration-paths.ts';

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
	patchTreeseedRuntime(distRoot);

	for (const filePath of walkFiles(distRoot)) {
		if (filePath.startsWith(`${vendoredStarlightRoot}/`) || filePath === vendoredStarlightRoot) continue;
		if (!(filePath.endsWith('.astro') || filePath.endsWith('.js'))) continue;
		const contents = readFileSync(filePath, 'utf8');
		writeFileSync(filePath, rewriteTreeseedStarlightSpecifiers(contents, filePath), 'utf8');
	}

	writeCompatibilityEntrypoint(
		resolve(distRoot, 'config.js'),
		"import starlight from './vendor/starlight/index.js';\nimport { loadTreeseedManifest } from '@treeseed/sdk/platform/tenant-config';\nimport { createTreeseedSite } from './site.js';\n\nexport function createTreeseedTenantSite(manifestPath) {\n\tconst tenant = loadTreeseedManifest(manifestPath);\n\treturn createTreeseedSite(tenant, { starlight });\n}"
	);
	writeCompatibilityEntrypoint(
		resolve(distRoot, 'config.d.ts'),
		"export declare function createTreeseedTenantSite(manifestPath?: string): import('astro').AstroUserConfig<never, never, never>;"
	);

	writeCompatibilityEntrypoint(
		resolve(distRoot, 'content.d.ts'),
		"export declare function createTreeseedCollections(tenantConfig: any, dependencies: any): Record<string, any>;"
	);

	writeCompatibilityEntrypoint(
		resolve(distRoot, 'content-config.js'),
		"import { loadTreeseedManifest } from '@treeseed/sdk/platform/tenant-config';\nimport { docsLoader } from './vendor/starlight/loaders.js';\nimport { docsSchema } from './vendor/starlight/schema.js';\nimport { createTreeseedCollections } from './content.js';\n\nexport function createTreeseedTenantCollections(manifestPath) {\n\tconst tenant = loadTreeseedManifest(manifestPath);\n\treturn createTreeseedCollections(tenant, { docsLoader, docsSchema });\n}"
	);
	writeCompatibilityEntrypoint(
		resolve(distRoot, 'content-config.d.ts'),
		"export declare function createTreeseedTenantCollections(manifestPath?: string): {\n\tpages: any;\n\tnotes: any;\n\tquestions: any;\n\tobjectives: any;\n\tpeople: any;\n\tagents: any;\n\tagent_tests?: any;\n\tbooks: any;\n\tdocs: any;\n\tworkdays?: any;\n};"
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
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
