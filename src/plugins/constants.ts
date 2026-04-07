export const TREESEED_DEFAULT_PLUGIN_PACKAGE = '@treeseed/core/plugin-default';

export const TREESEED_DEFAULT_PROVIDER_SELECTIONS = {
	forms: 'store_only',
	agents: {
		execution: 'stub',
		mutation: 'local_branch',
		repository: 'stub',
		verification: 'stub',
		notification: 'stub',
		research: 'stub',
	},
	deploy: 'cloudflare',
	content: {
		docs: 'default',
	},
	site: 'default',
};

export const TREESEED_DEFAULT_PLUGIN_REFERENCES = [
	{
		package: TREESEED_DEFAULT_PLUGIN_PACKAGE,
		enabled: true,
	},
];
