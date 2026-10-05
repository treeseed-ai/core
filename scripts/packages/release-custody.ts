import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { releaseEvidenceSchema } from '@treeseed/sdk/development';

const root = resolve(import.meta.dirname, '../..');
const sha256 = (path: string) => `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}` as const;
const command = process.argv[2];
const evidencePath = resolve(root, process.argv[3] ?? 'artifacts/release-evidence-v1.json');
if (command === 'seal') {
	const packagePath = resolve(root, process.argv[4]!);
	const sbomPath = resolve(root, 'artifacts/sbom.cdx.json');
	const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { name: string; version: string };
	const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
	const artifacts = [
		{ id: 'core-package', kind: 'npm-package' as const, identity: basename(packagePath), digest: sha256(packagePath), mediaType: 'application/gzip', size: statSync(packagePath).size },
		{ id: 'core-sbom', kind: 'sbom' as const, identity: basename(sbomPath), digest: sha256(sbomPath), mediaType: 'application/vnd.cyclonedx+json', size: statSync(sbomPath).size },
	];
	const receiptDigest = `sha256:${createHash('sha256').update(`${sourceCommit}\n${artifacts.map(({ digest }) => digest).join('\n')}`).digest('hex')}` as const;
	const evidence = releaseEvidenceSchema.parse({ schemaVersion: 'treeseed.release-evidence/v1', candidate: { id: `candidate-${sourceCommit.slice(0, 12)}`, receiptDigest, sourceCommit, stagingRef: process.env.GITHUB_REF ?? 'refs/heads/staging', workflowRunId: process.env.GITHUB_RUN_ID ?? '1', createdAt: new Date().toISOString() }, packages: [{ projectId: 'core', name: pkg.name, version: pkg.version, minimumBump: 'patch' }], artifacts, contractBundles: [], compatibilityAttestations: [], verification: { status: 'passed', operations: ['npm run verify:direct'], completedAt: new Date().toISOString() } });
	writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
} else if (command === 'verify') {
	const evidence = releaseEvidenceSchema.parse(JSON.parse(readFileSync(evidencePath, 'utf8')));
	const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
	if (evidence.candidate.sourceCommit !== commit) throw new Error('Candidate source commit differs from tagged commit.');
	if (process.env.GITHUB_REF?.startsWith('refs/tags/') && process.env.GITHUB_REF_NAME !== evidence.packages[0]?.version) throw new Error('Tag does not match sealed package version.');
	for (const artifact of evidence.artifacts) if (sha256(resolve(evidencePath, '..', artifact.identity)) !== artifact.digest) throw new Error(`Candidate artifact digest mismatch: ${artifact.identity}.`);
} else throw new Error('release:custody requires seal or verify.');
