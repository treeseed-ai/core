import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const contentPath = resolve('src/content.ts');
const text = readFileSync(contentPath, 'utf8');
const source = ts.createSourceFile(contentPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const factory = source.statements.find((statement): statement is ts.FunctionDeclaration =>
	ts.isFunctionDeclaration(statement) && statement.name?.text === 'createTreeseedCollections');
if (!factory?.body) throw new Error('createTreeseedCollections was not found.');

function variableName(statement: ts.Statement) {
	if (!ts.isVariableStatement(statement) || statement.declarationList.declarations.length !== 1) return null;
	const name = statement.declarationList.declarations[0]?.name;
	return name && ts.isIdentifier(name) ? name.text : null;
}

const variables = new Map(factory.body.statements.map((statement) => [variableName(statement), statement]));
const groups = {
	governance: [
		'pageFieldAliases', 'questionFieldAliases', 'objectiveFieldAliases', 'proposalFieldAliases', 'decisionFieldAliases',
		'contributorReference', 'pageSchema', 'noteSchema', 'questionSchema', 'objectiveSchema', 'proposalSchema', 'decisionSchema',
	],
	agent: [
		'agentFieldAliases', 'profileLinkSchema', 'agentWorktreeSchema', 'agentExecutionSchema', 'agentCapabilitySchema',
		'agentIdentitySchema', 'agentPromptSchema', 'agentToolPolicySchema', 'agentContentScopeSchema', 'agentContentAccessSchema',
		'agentBranchPolicySchema', 'agentQuestionPolicySchema', 'agentContentPermissionSchema', 'agentModePermissionPolicySchema',
		'agentPermissionPolicySchema', 'agentOutputsSchema', 'agentActivityExecutionSchema', 'agentActivityProfileSchema',
		'peopleSchema', 'agentSchema', 'agentTestSchema',
	],
	catalog: [
		'bookFieldAliases', 'sidebarItemSchema', 'bookSchema', 'publisherSchema', 'templateGitSourceSchema',
		'templateR2SourceSchema', 'templateProductSchema', 'knowledgePackSchema',
	],
	workday: ['workdaySummaryTaskSchema', 'workdayPriorityItemSchema', 'workdayReleaseSchema', 'workdaySchema'],
} as const;

const headers = {
	governance: `import { reference } from 'astro:content';
import { z } from 'astro/zod';
import type { TreeseedFieldAliasRegistry } from '@treeseed/sdk/field-aliases';
import { preprocessAliasedRecord } from '@treeseed/sdk/field-aliases';
import { DECISION_MODEL_DEFAULTS, NOTE_MODEL_DEFAULTS, OBJECTIVE_MODEL_DEFAULTS, PAGE_MODEL_DEFAULTS, PROPOSAL_MODEL_DEFAULTS, QUESTION_MODEL_DEFAULTS } from '../utils/site-config.ts';

const statusValues = ['live', 'in progress', 'exploratory', 'planned', 'speculative'] as const;
const pageLayoutValues = ['article', 'bridge'] as const;
const questionTypeValues = ['research', 'implementation', 'strategy', 'evaluation'] as const;
const proposalTypeValues = ['strategy', 'policy', 'implementation', 'research'] as const;
const decisionTypeValues = ['approved', 'rejected', 'deferred', 'request_changes', 'superseded'] as const;
const governanceStatusValues = ['draft', 'open', 'voting', 'accepted', 'rejected', 'no_decision_quorum_failed', 'withdrawn', 'superseded'] as const;
const timeHorizonValues = ['near-term', 'mid-term', 'long-term'] as const;
function withOptionalDefault<TSchema extends { default: (value: unknown) => TSchema }>(schema: TSchema, value: unknown) {
	return value === undefined ? schema : schema.default(value);
}`,
	agent: `import { reference } from 'astro:content';
import { z } from 'astro/zod';
import type { TreeseedFieldAliasRegistry } from '@treeseed/sdk/field-aliases';
import { preprocessAliasedRecord } from '@treeseed/sdk/field-aliases';
import { AGENT_ACTIVITY_TYPES } from '@treeseed/sdk/types/agents';
import { AGENT_MODEL_DEFAULTS, PEOPLE_MODEL_DEFAULTS } from '../utils/site-config.ts';

const statusValues = ['live', 'in progress', 'exploratory', 'planned', 'speculative'] as const;
const runtimeStatusValues = ['active', 'experimental', 'dormant'] as const;
const agentActivityTypeValues = AGENT_ACTIVITY_TYPES;
const agentHandlerValues = ['writer', 'actor', 'estimate', 'releaser', 'reporter'] as const;
function withOptionalDefault<TSchema extends { default: (value: unknown) => TSchema }>(schema: TSchema, value: unknown) {
	return value === undefined ? schema : schema.default(value);
}`,
	catalog: `import { z } from 'astro/zod';
import type { TreeseedFieldAliasRegistry } from '@treeseed/sdk/field-aliases';
import { preprocessAliasedRecord } from '@treeseed/sdk/field-aliases';
import { COMMERCE_OFFER_MODES, type CommerceOfferMode } from '@treeseed/sdk/types';
import { BOOK_MODEL_DEFAULTS } from '../utils/site-config.ts';

const commerceOfferModeValues = [...COMMERCE_OFFER_MODES] as [CommerceOfferMode, ...CommerceOfferMode[]];`,
	workday: `import { z } from 'astro/zod';`,
} as const;

mkdirSync(resolve('src/content'), { recursive: true });
for (const [group, names] of Object.entries(groups) as Array<[keyof typeof groups, readonly string[]]>) {
	const statements = names.map((name) => {
		const statement = variables.get(name);
		if (!statement) throw new Error(`Missing ${name} in createTreeseedCollections.`);
		return statement.getText(source);
	});
	const returned = names.filter((name) => /Schema$/u.test(name));
	const functionName = `create${group[0]!.toUpperCase()}${group.slice(1)}CollectionSchemas`;
	const body = statements.map((statement) => statement.split('\n').map((line) => `\t${line}`).join('\n')).join('\n\n');
	const output = `${headers[group]}\n\nexport function ${functionName}() {\n${body}\n\n\treturn { ${returned.join(', ')} };\n}\n`;
	writeFileSync(resolve('src/content', `${group}-schemas.ts`), output);
}

const firstExtracted = variables.get('pageFieldAliases');
const remaining = variables.get('docsCollectionProvider');
if (!firstExtracted || !remaining) throw new Error('Could not identify the schema extraction boundaries.');
const imports = `import { createGovernanceCollectionSchemas } from './content/governance-schemas.ts';
import { createAgentCollectionSchemas } from './content/agent-schemas.ts';
import { createCatalogCollectionSchemas } from './content/catalog-schemas.ts';
import { createWorkdayCollectionSchemas } from './content/workday-schemas.ts';
`;
const insertionPoint = text.lastIndexOf('\n', factory.getStart(source)) + 1;
const withImports = `${text.slice(0, insertionPoint)}${imports}${text.slice(insertionPoint, firstExtracted.getStart(source))}`;
const destructuring = `const { pageSchema, noteSchema, questionSchema, objectiveSchema, proposalSchema, decisionSchema } = createGovernanceCollectionSchemas();
	const { peopleSchema, agentSchema, agentTestSchema } = createAgentCollectionSchemas();
	const { bookSchema, templateProductSchema, knowledgePackSchema } = createCatalogCollectionSchemas();
	const { workdaySchema } = createWorkdayCollectionSchemas();
	`;
const adjustedRemainingStart = remaining.getStart(source) + imports.length;
const rewritten = `${withImports}${destructuring}${text.slice(adjustedRemainingStart - imports.length)}`;
writeFileSync(contentPath, rewritten);
