import { astroBin, createProductionBuildEnv, packageScriptPath, runNodeBinary, runNodeScript } from './package-tools.ts';

process.env.LOCAL_DEV_MODE = process.env.LOCAL_DEV_MODE ?? 'cloudflare';
runNodeScript(packageScriptPath('content/patch-starlight-content-path'), [], { cwd: process.cwd() });
runNodeBinary(astroBin, ['build'], {
	cwd: process.cwd(),
	env: createProductionBuildEnv({
		LOCAL_DEV_MODE: process.env.LOCAL_DEV_MODE,
	}),
});
runNodeScript(packageScriptPath('build/build-tenant-worker'), [], {
	cwd: process.cwd(),
	env: createProductionBuildEnv({
		LOCAL_DEV_MODE: process.env.LOCAL_DEV_MODE,
	}),
});
