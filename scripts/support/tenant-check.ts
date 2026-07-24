import { createProductionBuildEnv, packageScriptPath, runNodeScript } from '../packages/package-tools.ts';

const publishedRuntime = process.env.TREESEED_CONTENT_SERVING_MODE === 'published_runtime';

runNodeScript(packageScriptPath('content/patch-starlight-content-path'), [], { cwd: process.cwd() });
if (!publishedRuntime) {
	runNodeScript(packageScriptPath('content/aggregate-book'), [], { cwd: process.cwd() });
}
runNodeScript(packageScriptPath('build/tenant-build'), [], {
	cwd: process.cwd(),
	env: createProductionBuildEnv(),
});
