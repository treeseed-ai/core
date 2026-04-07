import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { build } from 'esbuild';
import ts from 'typescript';
import { packageRoot } from './package-tools.ts';

const require = createRequire(import.meta.url);
const srcRoot = resolve(packageRoot, 'src');
const scriptsRoot = resolve(packageRoot, 'scripts');
const distRoot = resolve(packageRoot, 'dist');

const JS_SOURCE_EXTENSIONS = new Set(['.ts', '.ts']);
const COPY_EXTENSIONS = new Set(['.astro', '.css', '.d.ts', '.js', '.json', '.jsonc', '.ts', '.yaml', '.yml']);

function walkFiles(root) {
	const files = [];
	for (const entry of readdirSync(root, { withFileTypes: true })) {
		const fullPath = join(root, entry.name);
		if (entry.isDirectory()) {
			files.push(...walkFiles(fullPath));
			continue;
		}
		files.push(fullPath);
	}
	return files;
}

function ensureDir(filePath) {
	mkdirSync(dirname(filePath), { recursive: true });
}

function rewriteRuntimeSpecifiers(contents) {
	return contents
		.replace(/(['"`])(\.[^'"`\n]+)\.(mjs|ts)\1/g, '$1$2.js$1')
		.replaceAll('../../../../sdk/src/sdk.js', '@treeseed/sdk/sdk')
		.replaceAll('../../../../sdk/src/sdk.ts', '@treeseed/sdk/sdk')
		.replaceAll('../../../../sdk/src/sdk-types.js', '@treeseed/sdk/types')
		.replaceAll('../../../../sdk/src/sdk-types.ts', '@treeseed/sdk/types')
		.replaceAll('../../../../sdk/src/model-registry.js', '@treeseed/sdk/models')
		.replaceAll('../../../../sdk/src/model-registry.ts', '@treeseed/sdk/models')
		.replaceAll('../../../../sdk/src/d1-store.js', '@treeseed/sdk/d1-store')
		.replaceAll('../../../../sdk/src/d1-store.ts', '@treeseed/sdk/d1-store')
		.replaceAll('../../../../sdk/src/content-store.js', '@treeseed/sdk/content-store')
		.replaceAll('../../../../sdk/src/content-store.ts', '@treeseed/sdk/content-store')
		.replaceAll('../../../../sdk/src/frontmatter.js', '@treeseed/sdk/frontmatter')
		.replaceAll('../../../../sdk/src/frontmatter.ts', '@treeseed/sdk/frontmatter')
		.replaceAll('../../../../sdk/src/git-runtime.js', '@treeseed/sdk/git-runtime')
		.replaceAll('../../../../sdk/src/git-runtime.ts', '@treeseed/sdk/git-runtime')
		.replaceAll('../../../../sdk/src/sdk-filters.js', '@treeseed/sdk/sdk-filters')
		.replaceAll('../../../../sdk/src/sdk-filters.ts', '@treeseed/sdk/sdk-filters')
		.replaceAll('../../../../sdk/src/wrangler-d1.js', '@treeseed/sdk/wrangler-d1')
		.replaceAll('../../../../sdk/src/wrangler-d1.ts', '@treeseed/sdk/wrangler-d1')
		.replaceAll('../../../../../sdk/src/stores/helpers.js', '@treeseed/sdk/stores/helpers')
		.replaceAll('../../../../../sdk/src/stores/helpers.ts', '@treeseed/sdk/stores/helpers')
		.replaceAll('../../../../../sdk/src/stores/cursor-store.js', '@treeseed/sdk/stores/cursor-store')
		.replaceAll('../../../../../sdk/src/stores/cursor-store.ts', '@treeseed/sdk/stores/cursor-store')
		.replaceAll('../../../../../sdk/src/stores/lease-store.js', '@treeseed/sdk/stores/lease-store')
		.replaceAll('../../../../../sdk/src/stores/lease-store.ts', '@treeseed/sdk/stores/lease-store')
		.replaceAll('../../../../../sdk/src/stores/message-store.js', '@treeseed/sdk/stores/message-store')
		.replaceAll('../../../../../sdk/src/stores/message-store.ts', '@treeseed/sdk/stores/message-store')
		.replaceAll('../../../../../sdk/src/stores/run-store.js', '@treeseed/sdk/stores/run-store')
		.replaceAll('../../../../../sdk/src/stores/run-store.ts', '@treeseed/sdk/stores/run-store')
		.replaceAll('../../../../../sdk/src/stores/subscription-store.js', '@treeseed/sdk/stores/subscription-store')
		.replaceAll('../../../../../sdk/src/stores/subscription-store.ts', '@treeseed/sdk/stores/subscription-store')
		.replaceAll('../../../../sdk/src/types/agents.js', '@treeseed/sdk/types/agents')
		.replaceAll('../../../../sdk/src/types/agents.ts', '@treeseed/sdk/types/agents')
		.replaceAll('../../../sdk/src/types/agents.js', '@treeseed/sdk/types/agents')
		.replaceAll('../../../sdk/src/types/agents.ts', '@treeseed/sdk/types/agents')
		.replaceAll('../../../../sdk/src/types/cloudflare.js', '@treeseed/sdk/types/cloudflare')
		.replaceAll('../../../../sdk/src/types/cloudflare.ts', '@treeseed/sdk/types/cloudflare')
		.replaceAll('../../../../sdk/src/types/cloudflare', '@treeseed/sdk/types/cloudflare')
		.replaceAll('../../../sdk/src/types/cloudflare.js', '@treeseed/sdk/types/cloudflare')
		.replaceAll('../../../sdk/src/types/cloudflare.ts', '@treeseed/sdk/types/cloudflare')
		.replaceAll('../../../sdk/src/types/cloudflare', '@treeseed/sdk/types/cloudflare');
}

function rewriteVendorImportSpecifiers(contents, importerFile) {
	return contents
		.replace(
			/(from\s+['"`]|import\s*\(\s*['"`]|export\s+\*\s+from\s+['"`]|export\s+\{[^}]*\}\s+from\s+['"`])(\.{1,2}\/[^'"`\n]+\.(?:json|jsonc))\?raw(['"`])/g,
			(match, prefix, specifier, suffix) => `${prefix}${specifier}.js${suffix}`,
		)
		.replace(
			/(from\s+['"`]|import\s*\(\s*['"`]|export\s+\*\s+from\s+['"`]|export\s+\{[^}]*\}\s+from\s+['"`])(\.{1,2}\/[^'"`\n]+\.json)(['"`])/g,
			(match, prefix, specifier, suffix) => `${prefix}${specifier}.js${suffix}`,
		)
		.replace(
			/(from\s+['"`]|import\s*\(\s*['"`]|export\s+\*\s+from\s+['"`]|export\s+\{[^}]*\}\s+from\s+['"`])(\.{1,2}\/[^'"`\n]+)(['"`])/g,
			(match, prefix, specifier, suffix) => {
			if (
				specifier.endsWith('/') ||
				/\.(?:js|mjs|cjs|json|jsonc|css|astro|svg|png|jpg|jpeg|gif|webp|avif|woff2?|ttf|otf)$/.test(specifier)
			) {
				return match;
			}

			const resolvedPath = resolve(dirname(importerFile), specifier);
			if (existsSync(`${resolvedPath}.js`)) {
				return `${prefix}${specifier}.js${suffix}`;
			}
			if (existsSync(resolve(resolvedPath, 'index.js'))) {
				return `${prefix}${specifier}/index.js${suffix}`;
			}

			return `${prefix}${specifier}.js${suffix}`;
			},
		);
}

function rewriteAstroAssetSpecifiers(contents, importerFile) {
	return contents.replace(
		/(<script[^>]+src=)(['"])(\.{1,2}\/[^'"`\n]+)(\2)/g,
		(match, prefix, quote, specifier, suffix) => {
			if (
				specifier.endsWith('/') ||
				/\.(?:js|mjs|cjs|json|jsonc|css|astro|svg|png|jpg|jpeg|gif|webp|avif|woff2?|ttf|otf)$/.test(specifier)
			) {
				return match;
			}

			const resolvedPath = resolve(dirname(importerFile), specifier);
			if (existsSync(`${resolvedPath}.js`)) {
				return `${prefix}${quote}${specifier}.js${suffix}`;
			}
			if (existsSync(resolve(resolvedPath, 'index.js'))) {
				return `${prefix}${quote}${specifier}/index.js${suffix}`;
			}

			return match;
		},
	);
}

function writeRawTextModule(sourceFile, sourceRoot, outputRoot) {
	const relativePath = relative(sourceRoot, sourceFile);
	const outputFile = resolve(outputRoot, `${relativePath}.js`);
	ensureDir(outputFile);
	const source = readFileSync(sourceFile, 'utf8');
	writeFileSync(outputFile, `export default ${JSON.stringify(source)};\n`, 'utf8');
}

function writeJsonModule(sourceFile, sourceRoot, outputRoot) {
	const relativePath = relative(sourceRoot, sourceFile);
	const outputFile = resolve(outputRoot, `${relativePath}.js`);
	ensureDir(outputFile);
	const source = readFileSync(sourceFile, 'utf8');
	const parsed = JSON.parse(source);
	const namedExports = Object.keys(parsed)
		.filter((key) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key))
		.map((key) => `export const ${key} = __treeseedJson.${key};`)
		.join('\n');
	writeFileSync(
		outputFile,
		`const __treeseedJson = ${JSON.stringify(parsed, null, 2)};\nexport default __treeseedJson;\n${namedExports}\n`,
		'utf8',
	);
}

function rewriteScriptRuntimeSpecifiers(contents) {
	return rewriteRuntimeSpecifiers(contents)
		.replace(/(['"`])\.\.\/src\//g, '$1../')
		.replace(/(['"`])\.\/src\//g, '$1./dist/')
		.replaceAll("'src/worker/forms-worker.ts'", "'dist/worker/forms-worker.js'")
		.replaceAll('"src/worker/forms-worker.ts"', '"dist/worker/forms-worker.js"')
		.replaceAll("'../src/deploy/config.ts'", "'../deploy/config.js'")
		.replaceAll('"../src/deploy/config.ts"', '"../deploy/config.js"')
		.replaceAll("'../src/deploy/config.ts'", "'../deploy/config.js'")
		.replaceAll('"../src/deploy/config.ts"', '"../deploy/config.js"');
}

async function compileModule(filePath, sourceRoot, outputRoot) {
	const relativePath = relative(sourceRoot, filePath);
	const outputFile = resolve(outputRoot, relativePath.replace(/\.(mjs|ts)$/u, '.js'));
	ensureDir(outputFile);

	await build({
		entryPoints: [filePath],
		outfile: outputFile,
		platform: 'node',
		format: 'esm',
		bundle: false,
		logLevel: 'silent',
		loader: {
			'.jsonc': 'text',
		},
	});

	const builtSource = readFileSync(outputFile, 'utf8');
	const rewritten = rewriteVendorImportSpecifiers(rewriteRuntimeSpecifiers(builtSource), outputFile);
	writeFileSync(outputFile, rewritten, 'utf8');
}

function copyAsset(filePath, sourceRoot, outputRoot) {
	const outputFile = resolve(outputRoot, relative(sourceRoot, filePath));
	ensureDir(outputFile);
	copyFileSync(filePath, outputFile);

	if (outputFile.endsWith('.astro') || outputFile.endsWith('.d.ts') || outputFile.endsWith('.js')) {
		const contents = readFileSync(outputFile, 'utf8');
		const rewritten = outputFile.endsWith('.js')
			? rewriteVendorImportSpecifiers(rewriteRuntimeSpecifiers(contents), outputFile)
			: rewriteRuntimeSpecifiers(contents);
		writeFileSync(outputFile, rewritten, 'utf8');
	}
}

function copyPackageAsset(packageName, relativePath, outputRelativePath) {
	let packageRootPath;
	try {
		packageRootPath = dirname(require.resolve(`${packageName}/package.json`));
	} catch {
		packageRootPath = dirname(require.resolve(packageName));
	}

	const sourceFile = resolve(packageRootPath, relativePath);
	const outputFile = resolve(packageRoot, outputRelativePath);
	ensureDir(outputFile);
	copyFileSync(sourceFile, outputFile);
}

function transpileScript(filePath) {
	const source = readFileSync(filePath, 'utf8');
	const relativePath = relative(scriptsRoot, filePath);
	const outputFile = resolve(distRoot, 'scripts', relativePath.replace(/\.(mjs|ts)$/u, '.js'));
	const transformed = extname(filePath) === '.ts'
		? ts.transpileModule(source, {
				compilerOptions: {
					module: ts.ModuleKind.ESNext,
					target: ts.ScriptTarget.ES2022,
				},
		  }).outputText
		: source;

	ensureDir(outputFile);
	const rewritten = rewriteVendorImportSpecifiers(rewriteScriptRuntimeSpecifiers(transformed), outputFile);
	writeFileSync(outputFile, rewritten, 'utf8');
	chmodSync(outputFile, 0o755);
}

function rewriteDeclarations() {
	for (const filePath of walkFiles(distRoot)) {
		if (!filePath.endsWith('.d.ts')) continue;
		const contents = readFileSync(filePath, 'utf8');
		writeFileSync(filePath, rewriteRuntimeSpecifiers(contents), 'utf8');
	}
}

function emitTypeDeclarations() {
	const sourceFiles = [
		resolve(srcRoot, 'contracts.ts'),
		resolve(srcRoot, 'environment.ts'),
		resolve(srcRoot, 'types/agents.ts'),
		resolve(srcRoot, 'types/cloudflare.ts'),
		resolve(srcRoot, 'plugins/plugin.ts'),
		resolve(srcRoot, 'site-resources.ts'),
		resolve(srcRoot, 'utils/agents/runtime-types.ts'),
		resolve(srcRoot, 'utils/agents/contracts/messages.ts'),
		resolve(srcRoot, 'utils/agents/contracts/run.ts'),
	].filter((filePath) => existsSync(filePath));

	if (sourceFiles.length === 0) {
		return;
	}

	const compilerOptions = {
		allowImportingTsExtensions: true,
		declaration: true,
		emitDeclarationOnly: true,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		outDir: distRoot,
		rootDir: srcRoot,
		skipLibCheck: true,
		target: ts.ScriptTarget.ES2022,
	};

	const program = ts.createProgram(sourceFiles, compilerOptions);
	const emitResult = program.emit();
	const diagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics ?? []);

	if (diagnostics.length > 0) {
		const message = diagnostics
			.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
			.join('\n');
		throw new Error(`Failed to emit Treeseed core declarations:\n${message}`);
	}

	if (emitResult.emitSkipped) {
		throw new Error('Failed to emit Treeseed core declarations.');
	}
}

function toPosixRelative(fromFile, toFile) {
	return relative(dirname(fromFile), toFile).replaceAll('\\', '/');
}

function rewriteTreeseedStarlightSpecifiers(contents, filePath) {
	const componentsIndex = toPosixRelative(filePath, resolve(distRoot, 'vendor', 'starlight', 'components.js'));
	const routeData = toPosixRelative(filePath, resolve(distRoot, 'vendor', 'starlight', 'route-data.js'));

	return contents
		.replaceAll("'@astrojs/starlight/components'", `'${componentsIndex}'`)
		.replaceAll('"@astrojs/starlight/components"', `"${componentsIndex}"`)
		.replaceAll("'@astrojs/starlight/route-data'", `'${routeData}'`)
		.replaceAll('"@astrojs/starlight/route-data"', `"${routeData}"`)
		.replace(/(['"])@astrojs\/starlight\/components\/([^'"\n]+)\1/g, (match, quote, subpath) => {
			const target = toPosixRelative(filePath, resolve(distRoot, 'vendor', 'starlight', 'components', subpath));
			return `${quote}${target}${quote}`;
		});
}

async function compileVendorPackage(sourceRoot, outputRoot) {
	for (const filePath of walkFiles(sourceRoot)) {
		if (filePath.endsWith('.d.ts')) {
			copyAsset(filePath, sourceRoot, outputRoot);
			continue;
		}

		const extension = extname(filePath);
		if (extension === '.ts') {
			await compileModule(filePath, sourceRoot, outputRoot);
			continue;
		}

		if (COPY_EXTENSIONS.has(extension)) {
			copyAsset(filePath, sourceRoot, outputRoot);
			if (extension === '.jsonc') {
				writeRawTextModule(filePath, sourceRoot, outputRoot);
			}
			if (extension === '.json') {
				writeJsonModule(filePath, sourceRoot, outputRoot);
			}
		}
	}

	for (const filePath of walkFiles(outputRoot)) {
		if (filePath.endsWith('.astro')) {
			const contents = readFileSync(filePath, 'utf8');
			writeFileSync(filePath, rewriteAstroAssetSpecifiers(contents, filePath), 'utf8');
			continue;
		}
		if (!filePath.endsWith('.js')) continue;
		const contents = readFileSync(filePath, 'utf8');
		writeFileSync(filePath, rewriteVendorImportSpecifiers(contents, filePath), 'utf8');
	}
}

function writeCompatibilityEntrypoint(outputFile, contents) {
	ensureDir(outputFile);
	writeFileSync(outputFile, `${contents}
`, 'utf8');
}

function patchVendoredStarlight(distVendorRoot) {
	const indexFile = resolve(distVendorRoot, 'index.js');
	if (readdirSync(dirname(indexFile)).includes('index.js')) {
		let source = readFileSync(indexFile, 'utf8')
			.replaceAll('@astrojs/starlight/locals', './locals.js')
			.replaceAll('@astrojs/starlight/routes/static/404.astro', './routes/static/404.astro')
			.replaceAll('@astrojs/starlight/routes/ssr/404.astro', './routes/ssr/404.astro')
			.replaceAll('@astrojs/starlight/routes/static/index.astro', './routes/static/index.astro')
			.replaceAll('@astrojs/starlight/routes/ssr/index.astro', './routes/ssr/index.astro');

		if (!source.includes('from "node:url"')) {
			source = `import { fileURLToPath } from "node:url";\n${source}`;
		}

		source = source
			.replace(
				'addMiddleware({ entrypoint: "./locals.js", order: "pre" });',
				'addMiddleware({ entrypoint: fileURLToPath(new URL("./locals.js", import.meta.url)), order: "pre" });',
			)
			.replaceAll(
				'"./routes/static/404.astro"',
				'fileURLToPath(new URL("./routes/static/404.astro", import.meta.url))',
			)
			.replaceAll(
				'"./routes/ssr/404.astro"',
				'fileURLToPath(new URL("./routes/ssr/404.astro", import.meta.url))',
			)
			.replaceAll(
				'"./routes/static/index.astro"',
				'fileURLToPath(new URL("./routes/static/index.astro", import.meta.url))',
			)
			.replaceAll(
				'"./routes/ssr/index.astro"',
				'fileURLToPath(new URL("./routes/ssr/index.astro", import.meta.url))',
			);

		source = source
			.replaceAll('name: "@astrojs/starlight"', 'name: "@treeseed/core-vendored-starlight"')
			.replaceAll('i.name === "@astrojs/starlight"', 'i.name === "@treeseed/core-vendored-starlight"');

		writeFileSync(indexFile, source, 'utf8');
	}
}

function patchTreeseedRuntime(distRuntimeRoot) {
	const middlewareFile = resolve(distRuntimeRoot, 'middleware', 'starlightRouteData.js');
	if (existsSync(middlewareFile)) {
		const source = readFileSync(middlewareFile, 'utf8').replaceAll(
			'"@astrojs/starlight/route-data"',
			'"../vendor/starlight/route-data.js"',
		);
		writeFileSync(middlewareFile, source, 'utf8');
	}
}

async function main() {
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

		if (COPY_EXTENSIONS.has(extension) || filePath.endsWith('.d.ts')) {
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
		"import starlight from './vendor/starlight/index.js';\nimport { createTreeseedSite } from './site.js';\nimport { loadTreeseedManifest } from './tenant/config.js';\n\nexport function createTreeseedTenantSite(manifestPath) {\n\tconst tenant = loadTreeseedManifest(manifestPath);\n\treturn createTreeseedSite(tenant, { starlight });\n}"
	);

	writeCompatibilityEntrypoint(
		resolve(distRoot, 'content-config.js'),
		"import { docsLoader } from './vendor/starlight/loaders.js';\nimport { docsSchema } from './vendor/starlight/schema.js';\nimport { createTreeseedCollections } from './content.js';\nimport { loadTreeseedManifest } from './tenant/config.js';\n\nexport function createTreeseedTenantCollections(manifestPath) {\n\tconst tenant = loadTreeseedManifest(manifestPath);\n\treturn createTreeseedCollections(tenant, { docsLoader, docsSchema });\n}"
	);

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
