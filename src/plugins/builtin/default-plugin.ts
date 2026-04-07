import { defineTreeseedPlugin } from '../plugin';

export default defineTreeseedPlugin({
	id: 'treeseed-core-default',
	provides: {
		forms: ['store_only', 'notify_admin', 'full_email'],
		agents: {
			execution: ['stub', 'manual', 'copilot'],
			mutation: ['local_branch'],
			repository: ['stub', 'git'],
			verification: ['stub', 'local'],
			notification: ['stub'],
			research: ['stub'],
			handlers: [
				'planner',
				'architect',
				'engineer',
				'notifier',
				'researcher',
				'reviewer',
				'releaser',
			],
		},
		deploy: ['cloudflare'],
		content: {
			docs: ['default'],
		},
		site: ['default'],
	},
});
