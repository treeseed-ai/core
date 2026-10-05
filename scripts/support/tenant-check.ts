import { createProductionBuildEnv, packageScriptPath, runNodeScript } from '../packages/package-tools.ts';

runNodeScript(packageScriptPath('content/patch-starlight-content-path'), [], { cwd: process.cwd() });
runNodeScript(packageScriptPath('build/tenant-build'), [], {
	cwd: process.cwd(),
	env: createProductionBuildEnv(),
});
