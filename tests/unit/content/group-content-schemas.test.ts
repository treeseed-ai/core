import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { createGroupCollectionSchemas } from '../../../src/content/group-schemas.ts';

function frontmatter(path: string) {
	const raw = readFileSync(path, 'utf8');
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/u);
	if (!match) throw new Error(`Missing frontmatter in ${path}.`);
	return parse(match[1]!);
}

describe('group content schemas', () => {
	it('keeps group definitions while agent authority remains exclusively in TreeDX', () => {
		const fixture = resolve('.fixtures/treeseed-fixtures/sites/working-site/src/content');
		const group = frontmatter(resolve(fixture, 'groups/architecture.md'));
		const agentDirectory = resolve(fixture, 'agents');
		expect(existsSync(agentDirectory) ? readdirSync(agentDirectory) : []).toEqual([]);
		expect(createGroupCollectionSchemas().groupSchema.safeParse(group).success).toBe(true);
	});
});
