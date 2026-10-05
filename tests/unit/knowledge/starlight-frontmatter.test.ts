import { describe, expect, it } from 'vitest';
import { bookSidebar, starlightKnowledgeFrontmatter } from '../../../src/utils/knowledge/reader-library';

describe('Starlight knowledge frontmatter', () => {
	it('omits nullable optional repository metadata before Starlight validation', () => {
		const frontmatter = starlightKnowledgeFrontmatter({
			title: 'Getting started',
			summary: 'Published from an exact revision.',
			parentId: null,
			cover: undefined,
			order: 0,
		});

		expect(frontmatter).toMatchObject({
			title: 'Getting started',
			description: 'Published from an exact revision.',
			order: 0,
			editUrl: false,
		});
		expect(frontmatter).not.toHaveProperty('parentId');
		expect(frontmatter).not.toHaveProperty('cover');
	});

	it('renders parent and child pages as nested Starlight navigation', () => {
		const sidebar = bookSidebar('treeseed', { id: 'guide', data: { id: 'guide', slug: 'guide', title: 'Guide' } }, [
			{ id: 'child', data: { id: 'child', parentId: 'parent', slug: 'parent/child', title: 'Child', order: 1 } },
			{ id: 'parent', data: { id: 'parent', slug: 'parent', title: 'Parent', order: 1 } },
		]);
		expect(sidebar[0].items[1]).toMatchObject({ label: 'Parent', items: [{ label: 'Child' }] });
	});
});
