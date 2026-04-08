import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const packageJsonPath = resolve(packageRoot, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const packageVersion = packageJson.version;
const legacyPrefix = 'treeseed-core-v';

const tagName = process.argv[2] || process.env.GITHUB_REF_NAME;

if (!tagName) {
	console.error('Release tag validation requires a tag name argument or GITHUB_REF_NAME.');
	process.exit(1);
}

const taggedVersion = tagName.startsWith(legacyPrefix)
	? tagName.slice(legacyPrefix.length)
	: tagName;

if (taggedVersion !== packageVersion) {
	console.error(
		`Release tag version "${taggedVersion}" does not match @treeseed/core version "${packageVersion}".`,
	);
	process.exit(1);
}

console.log(`Release tag "${tagName}" matches @treeseed/core version "${packageVersion}".`);
