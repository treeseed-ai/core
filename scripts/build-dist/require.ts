import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { build } from 'esbuild';
import ts from 'typescript';
import { packageRoot } from ".././package-tools.ts";


export const require = createRequire(import.meta.url);

export const srcRoot = resolve(packageRoot, 'src');

export const scriptsRoot = resolve(packageRoot, 'scripts');

export const distRoot = resolve(packageRoot, 'dist');

export const workspaceSdkDistRoot = resolve(packageRoot, '..', 'sdk', 'dist');

export const JS_SOURCE_EXTENSIONS = new Set(['.ts', '.ts']);

export const COPY_EXTENSIONS = new Set(['.astro', '.css', '.d.ts', '.js', '.json', '.jsonc', '.ts', '.yaml', '.yml']);

export function walkFiles(root) {
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

export function ensureDir(filePath) {
	mkdirSync(dirname(filePath), { recursive: true });
}

export function rewriteRuntimeSpecifiers(contents) {
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

export function rewriteVendorImportSpecifiers(contents, importerFile) {
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

export function rewriteAstroAssetSpecifiers(contents, importerFile) {
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

export function writeRawTextModule(sourceFile, sourceRoot, outputRoot) {
	const relativePath = relative(sourceRoot, sourceFile);
	const outputFile = resolve(outputRoot, `${relativePath}.js`);
	ensureDir(outputFile);
	const source = readFileSync(sourceFile, 'utf8');
	writeFileSync(outputFile, `export default ${JSON.stringify(source)};\n`, 'utf8');
}

export function writeJsonModule(sourceFile, sourceRoot, outputRoot) {
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

export function rewriteScriptRuntimeSpecifiers(contents) {
	return rewriteRuntimeSpecifiers(contents)
		.replace(/(['"`])\.\.\/src\//g, '$1../')
		.replace(/(['"`])\.\/src\//g, '$1./dist/')
		.replaceAll("'src/worker/forms-worker.ts'", "'dist/worker/forms-worker.js'")
		.replaceAll('"src/worker/forms-worker.ts"', '"dist/worker/forms-worker.js"');
}

export async function compileModule(filePath, sourceRoot, outputRoot) {
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

export function copyAsset(filePath, sourceRoot, outputRoot) {
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

export function copyPackageAsset(packageName, relativePath, outputRelativePath) {
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

export function transpileScript(filePath) {
	const source = readFileSync(filePath, 'utf8');
	const relativePath = relative(scriptsRoot, filePath);
	if (relativePath === 'fixture-tools.ts') {
		return;
	}
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

export function rewriteDeclarations() {
	for (const filePath of walkFiles(distRoot)) {
		if (!filePath.endsWith('.d.ts')) continue;
		const contents = readFileSync(filePath, 'utf8');
		writeFileSync(filePath, rewriteRuntimeSpecifiers(contents), 'utf8');
	}
}

export function relativePathForTsconfig(fromRoot, targetPath) {
	return relative(fromRoot, targetPath).replaceAll('\\', '/');
}
