import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';

export async function GET(context: APIContext) {
	const notes = (await getCollection('notes', ({ data }) => !data.draft)).sort(
		(a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
	);
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
