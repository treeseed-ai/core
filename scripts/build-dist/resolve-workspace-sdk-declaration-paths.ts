import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { packageRoot } from ".././package-tools.ts";
import { COPY_EXTENSIONS, compileModule, copyAsset, distRoot, ensureDir, relativePathForTsconfig, rewriteAstroAssetSpecifiers, rewriteVendorImportSpecifiers, srcRoot, walkFiles, workspaceSdkDistRoot, writeJsonModule, writeRawTextModule } from './require.ts';

export function resolveWorkspaceSdkDeclarationPaths() {
	if (!existsSync(resolve(workspaceSdkDistRoot, 'index.d.ts'))) {
		return null;
	}
	return {
		'@treeseed/sdk': [relativePathForTsconfig(packageRoot, resolve(workspaceSdkDistRoot, 'index.d.ts'))],
		'@treeseed/sdk/hosting': [relativePathForTsconfig(packageRoot, resolve(workspaceSdkDistRoot, 'hosting', 'index.d.ts'))],
		'@treeseed/sdk/types': [relativePathForTsconfig(packageRoot, resolve(workspaceSdkDistRoot, 'sdk-types.d.ts'))],
		'@treeseed/sdk/types/*': [relativePathForTsconfig(packageRoot, resolve(workspaceSdkDistRoot, 'types', '*.d.ts'))],
		'@treeseed/sdk/*/index': [relativePathForTsconfig(packageRoot, resolve(workspaceSdkDistRoot, '*', 'index.d.ts'))],
		'@treeseed/sdk/*': [relativePathForTsconfig(packageRoot, resolve(workspaceSdkDistRoot, '*.d.ts'))],
	};
}

export function emitTypeDeclarations() {
	const sourceFiles = [
		resolve(srcRoot, 'types/astro-build.d.ts'),
		resolve(srcRoot, 'types/cloudflare.ts'),
		resolve(srcRoot, 'utils/site-models.ts'),
		resolve(srcRoot, 'middleware/editorial-preview.ts'),
		resolve(srcRoot, 'site-resources.ts'),
		resolve(srcRoot, 'platform-resources.ts'),
		resolve(srcRoot, 'api.ts'),
		resolve(srcRoot, 'agent.ts'),
		resolve(srcRoot, 'agent-runtime.ts'),
		resolve(srcRoot, 'railway.ts'),
		resolve(srcRoot, 'platform.ts'),
		resolve(srcRoot, 'templates.ts'),
		resolve(srcRoot, 'services/index.ts'),
		resolve(srcRoot, 'plugin-default.ts'),
		resolve(srcRoot, 'index.ts'),
		...(existsSync(resolve(srcRoot, 'api')) ? walkFiles(resolve(srcRoot, 'api')).filter((filePath) => filePath.endsWith('.ts') && !filePath.endsWith('.d.ts')) : []),
		...(existsSync(resolve(srcRoot, 'agents')) ? walkFiles(resolve(srcRoot, 'agents')).filter((filePath) => filePath.endsWith('.ts') && !filePath.endsWith('.d.ts')) : []),
		...(existsSync(resolve(srcRoot, 'services')) ? walkFiles(resolve(srcRoot, 'services')).filter((filePath) => filePath.endsWith('.ts') && !filePath.endsWith('.d.ts')) : []),
	].filter((filePath) => existsSync(filePath));

	if (sourceFiles.length === 0) {
		return;
	}

	const compilerOptions = {
		allowImportingTsExtensions: true,
		baseUrl: packageRoot,
		declaration: true,
		emitDeclarationOnly: true,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		outDir: distRoot,
		paths: resolveWorkspaceSdkDeclarationPaths() ?? undefined,
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

export function toPosixRelative(fromFile, toFile) {
	return relative(dirname(fromFile), toFile).replaceAll('\\', '/');
}

export function rewriteTreeseedStarlightSpecifiers(contents, filePath) {
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

export async function compileVendorPackage(sourceRoot, outputRoot) {
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

export function writeCompatibilityEntrypoint(outputFile, contents) {
	ensureDir(outputFile);
	writeFileSync(outputFile, `${contents}
`, 'utf8');
}

export function patchVendoredStarlight(distVendorRoot) {
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

export function patchTreeseedRuntime(distRuntimeRoot) {
	const middlewareFile = resolve(distRuntimeRoot, 'middleware', 'starlightRouteData.js');
	if (existsSync(middlewareFile)) {
		const source = readFileSync(middlewareFile, 'utf8').replaceAll(
			'"@astrojs/starlight/route-data"',
			'"../vendor/starlight/route-data.js"',
		);
		writeFileSync(middlewareFile, source, 'utf8');
	}
}
