import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import { createAgentCollectionSchemas } from '../../../src/content/agent-schemas.ts';
import { createCatalogCollectionSchemas } from '../../../src/content/catalog-schemas.ts';
import { createWorkdayCollectionSchemas } from '../../../src/content/workday-schemas.ts';

vi.mock('astro:content', () => ({ reference: () => z.string() }));

function frontmatter(path: string) {
	const match = readFileSync(path, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/u);
	if (!match) throw new Error(`Missing frontmatter in ${path}.`);
	return parse(match[1]!);
}

describe('portable auxiliary content schemas', () => {
	it('validates live template and agent-test content through SDK-owned Zod schemas', () => {
		const root = resolve('tests/fixtures/library');
		expect(createCatalogCollectionSchemas().templateProductSchema.safeParse(
			frontmatter(resolve(root, 'templates/engineering.mdx')),
		).success).toBe(true);
		expect(createAgentCollectionSchemas().agentTestSchema.safeParse(
			frontmatter(resolve(root, 'agent-tests/docs-reviewer-basic.mdx')),
		).success).toBe(true);
	});

	it('validates the canonical agent permission matrix through Core and SDK schemas',() => {
		const root = resolve('docs/src/content');
		const definition=frontmatter(resolve(root,'agents/engineer.mdx'));
		definition.contextQueryRefs=[{id:'current-project-context',revision:1}];
		definition.contextQuerySetRefs=[{id:'engineering-context',revision:2}];
		definition.instructionTemplateRefs=[{id:'assignment-plan-standard',revision:1}];
		definition.activityProfiles.planning.instructionTemplateRefs=[{id:'assignment-plan-standard',revision:1}];
		const parsed = createAgentCollectionSchemas().agentSchema.safeParse(definition);
		expect(parsed.success, parsed.success ? undefined : parsed.error.message).toBe(true);
	});

	it('preserves the Astro workday collection contract with portable field diagnostics', () => {
		const result = createWorkdayCollectionSchemas().workdaySchema.safeParse({
			title: 'Broken workday', slug: 'broken', workDayId: '', reportVersion: 'v1', projectId: 'project-1',
			environment: 'local', workdayState: 'running', startedAt: 'not-a-date', generatedAt: new Date(), summary: 'Invalid input.',
		});
		expect(result.success).toBe(false);
		if (!result.success) expect(result.error.issues.map((issue) => issue.path.join('.'))).toEqual(expect.arrayContaining([
			'workDayId', 'startedAt',
		]));
	});
});
