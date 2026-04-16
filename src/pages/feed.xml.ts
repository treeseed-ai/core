import type { APIContext } from 'astro';
import { getPublishedNotes } from '../utils/hub-content';
import { siteModelRendered } from '../utils/site-models.ts';

export async function GET(context: APIContext) {
	if (!siteModelRendered('notes')) {
		return new Response('Not found', { status: 404 });
	}
	const notes = await getPublishedNotes();
	const origin = context.site?.origin ?? 'https://treeseed.dev';

	const items = notes
		.map(
			(note) => `
      <item>
        <title><![CDATA[${note.data.title}]]></title>
        <link>${origin}/notes/${note.id}/</link>
        <guid>${origin}/notes/${note.id}/</guid>
        <pubDate>${note.data.date.toUTCString()}</pubDate>
        <description><![CDATA[${note.data.description}]]></description>
      </item>`,
		)
		.join('\n');

	const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>TreeSeed Notes</title>
    <link>${origin}/notes/</link>
    <description>Working notes from the TreeSeed fixture site.</description>
    ${items}
  </channel>
</rss>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
		},
	});
}
