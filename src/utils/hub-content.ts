import type { CollectionEntry, getEntries } from 'astro:content';
import { siteModelRendered } from './site-models.ts';

export type ContributorEntry = CollectionEntry<'people'> | CollectionEntry<'agents'>;
export type HubQuestionEntry = CollectionEntry<'questions'>;
export type HubObjectiveEntry = CollectionEntry<'objectives'>;
export type HubProposalEntry = CollectionEntry<'proposals'>;
export type HubDecisionEntry = CollectionEntry<'decisions'>;
export type HubBookEntry = CollectionEntry<'books'>;

export function sortEntriesByDateDescending<T extends { data: { date: Date } }>(entries: T[]) {
	return [...entries].sort((left, right) => right.data.date.valueOf() - left.data.date.valueOf());
}

async function contentApi() {
	return import('astro:content');
}

export async function resolveContributor(reference: CollectionEntry<'questions'>['data']['primaryContributor']) {
	const { getEntry } = await contentApi();
	return getEntry(reference) as Promise<ContributorEntry | undefined>;
}

export async function resolveContributorsForEntries<
	T extends { id: string; data: { primaryContributor: CollectionEntry<'questions'>['data']['primaryContributor'] } },
>(entries: T[]) {
	const contributors = await Promise.all(entries.map((entry) => resolveContributor(entry.data.primaryContributor)));
	return new Map(entries.map((entry, index) => [entry.id, contributors[index] ?? null]));
}

export async function resolveReferences<T extends Parameters<typeof getEntries>[0]>(references: T) {
	const { getEntries } = await contentApi();
	return getEntries(references);
}

export async function getPublishedQuestions() {
	if (!siteModelRendered('questions')) {
		return [];
	}
	const { getCollection } = await contentApi();
	return sortEntriesByDateDescending(await getCollection('questions', ({ data }) => !data.draft));
}

export async function getPublishedObjectives() {
	if (!siteModelRendered('objectives')) {
		return [];
	}
	const { getCollection } = await contentApi();
	return sortEntriesByDateDescending(await getCollection('objectives', ({ data }) => !data.draft));
}

export async function getPublishedProposals() {
	if (!siteModelRendered('proposals')) {
		return [];
	}
	const { getCollection } = await contentApi();
	return sortEntriesByDateDescending(await getCollection('proposals', ({ data }) => !data.draft));
}

export async function getPublishedDecisions() {
	if (!siteModelRendered('decisions')) {
		return [];
	}
	const { getCollection } = await contentApi();
	return sortEntriesByDateDescending(await getCollection('decisions', ({ data }) => !data.draft));
}

export async function getPublishedNotes() {
	if (!siteModelRendered('notes')) {
		return [];
	}
	const { getCollection } = await contentApi();
	return sortEntriesByDateDescending(await getCollection('notes', ({ data }) => !data.draft));
}

export async function getPublishedPeople() {
	if (!siteModelRendered('people')) {
		return [];
	}
	const { getCollection } = await contentApi();
	return getCollection('people');
}

export async function getPublishedAgents() {
	if (!siteModelRendered('agents')) {
		return [];
	}
	const { getCollection } = await contentApi();
	return getCollection('agents');
}

export async function getPublishedBooks() {
	if (!siteModelRendered('books')) {
		return [];
	}
	const { getCollection } = await contentApi();
	return (await getCollection('books')).sort((a, b) => a.data.order - b.data.order);
}
