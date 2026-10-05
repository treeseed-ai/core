export default {
	id: 'treeseed-core-default',
	provides: {
		forms: ['store_only', 'notify_admin', 'full_email'], operations: ['default'],
		agents: { execution: ['codex'], mutation: ['local_branch'], repository: ['git'], verification: ['local'], notification: ['sdk_message'], research: ['project_graph'] },
		deploy: ['cloudflare'], dns: ['cloudflare-dns'],
		content: { runtime: ['filesystem', 'team_scoped_r2_overlay'], publish: ['filesystem', 'team_scoped_r2_overlay'], docs: ['default'] },
		site: ['default'],
	},
};
