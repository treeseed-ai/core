import { createProductionBuildEnv, packageScriptPath, runNodeScript } from './package-tools.ts';

const publishedRuntime = process.env.TREESEED_CONTENT_SERVING_MODE === 'published_runtime';

runNodeScript(packageScriptPath('patch-starlight-content-path'), [], { cwd: process.cwd() });
if (!publishedRuntime) {
	runNodeScript(packageScriptPath('aggregate-book'), [], { cwd: process.cwd() });
}
runNodeScript(packageScriptPath('tenant-build'), [], {
	cwd: process.cwd(),
	env: createProductionBuildEnv(),
});
