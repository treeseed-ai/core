import { readFileSync } from 'node:fs';
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
	it('accepts migrated agents and generated group definitions without legacy tags', () => {
		const fixture = resolve('.fixtures/treeseed-fixtures/sites/working-site/src/content');
		const agent = frontmatter(resolve(fixture, 'agents/architect.mdx'));
		const group = frontmatter(resolve(fixture, `groups/${agent.groupIds[0]}.md`));
		expect(agent.tags).toBeUndefined();
		expect(agent.groupIds).toEqual(expect.arrayContaining([expect.any(String)]));
		expect(createGroupCollectionSchemas().groupSchema.safeParse(group).success).toBe(true);
	});
});
