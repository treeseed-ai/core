import { getCollection, getEntries, getEntry, type CollectionEntry } from 'astro:content';

export type ContributorEntry = CollectionEntry<'people'> | CollectionEntry<'agents'>;
export type HubQuestionEntry = CollectionEntry<'questions'>;
export type HubObjectiveEntry = CollectionEntry<'objectives'>;
export type HubBookEntry = CollectionEntry<'books'>;

export function sortEntriesByDateDescending<T extends { data: { date: Date } }>(entries: T[]) {
	return [...entries].sort((left, right) => right.data.date.valueOf() - left.data.date.valueOf());
}

export async function resolveContributor(reference: CollectionEntry<'questions'>['data']['primaryContributor']) {
	return getEntry(reference) as Promise<ContributorEntry | undefined>;
}

export async function resolveContributorsForEntries<
	T extends { id: string; data: { primaryContributor: CollectionEntry<'questions'>['data']['primaryContributor'] } },
>(entries: T[]) {
	const contributors = await Promise.all(entries.map((entry) => resolveContributor(entry.data.primaryContributor)));
	return new Map(entries.map((entry, index) => [entry.id, contributors[index] ?? null]));
}

export async function resolveReferences<T extends Parameters<typeof getEntries>[0]>(references: T) {
	return getEntries(references);
}

export async function getPublishedQuestions() {
	return sortEntriesByDateDescending(await getCollection('questions', ({ data }) => !data.draft));
}

export async function getPublishedObjectives() {
	return sortEntriesByDateDescending(await getCollection('objectives', ({ data }) => !data.draft));
}
