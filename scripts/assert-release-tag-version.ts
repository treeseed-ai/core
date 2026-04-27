import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const packageJsonPath = resolve(packageRoot, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const packageVersion = packageJson.version;

const tagName = process.argv[2] || process.env.GITHUB_REF_NAME;

if (!tagName) {
	console.error('Release tag validation requires a tag name argument or GITHUB_REF_NAME.');
	process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(tagName)) {
	console.error(`Release tag "${tagName}" must use plain semver format "x.y.z".`);
	process.exit(1);
}

if (tagName !== packageVersion) {
	console.error(
		`Release tag version "${tagName}" does not match @treeseed/core version "${packageVersion}".`,
	);
	process.exit(1);
}

console.log(`Release tag "${tagName}" matches @treeseed/core version "${packageVersion}".`);
