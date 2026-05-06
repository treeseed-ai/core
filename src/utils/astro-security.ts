import type { TreeseedDeployConfig, TreeseedManagedServiceEnvironmentConfig } from '@treeseed/sdk/platform/contracts';

export interface TreeseedAstroAllowedDomain {
	hostname: string;
	protocol?: string;
	port?: string;
	pathname?: string;
}

const LOCAL_ASTRO_HOSTS = ['localhost', '127.0.0.1'];

function hostnameFromUrlLike(value: string | null | undefined) {
	const trimmed = value?.trim();
	if (!trimmed) return null;
	const candidate = URL.canParse(trimmed)
		? trimmed
		: URL.canParse(`https://${trimmed}`)
			? `https://${trimmed}`
			: null;
	if (!candidate) return null;
	const url = new URL(candidate);
	return url.hostname.trim().toLowerCase() || null;
}

function appendHostname(hostnames: string[], value: string | null | undefined) {
	const hostname = hostnameFromUrlLike(value);
	if (hostname && !hostnames.includes(hostname)) {
		hostnames.push(hostname);
	}
}

function appendEnvironmentHostnames(hostnames: string[], environments: Iterable<TreeseedManagedServiceEnvironmentConfig | undefined>) {
	for (const environment of environments) {
		appendHostname(hostnames, environment?.domain);
		appendHostname(hostnames, environment?.baseUrl);
	}
}

export function deriveTreeseedAstroAllowedDomains(
	deployConfig: Pick<TreeseedDeployConfig, 'siteUrl' | 'surfaces'>,
	options: { siteUrl?: string | null } = {},
): TreeseedAstroAllowedDomain[] {
	const hostnames: string[] = [];
	const webSurface = deployConfig.surfaces?.web;

	appendHostname(hostnames, deployConfig.siteUrl);
	appendHostname(hostnames, options.siteUrl);
	appendHostname(hostnames, webSurface?.publicBaseUrl);
	appendHostname(hostnames, webSurface?.localBaseUrl);
	appendEnvironmentHostnames(hostnames, Object.values(webSurface?.environments ?? {}));

	for (const hostname of LOCAL_ASTRO_HOSTS) {
		appendHostname(hostnames, hostname);
	}

	return hostnames.map((hostname) => ({ hostname }));
}
