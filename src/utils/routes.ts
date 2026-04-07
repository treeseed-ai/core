import { SITE_HEADER_MENU } from './site-config';

export const SITE_NAV_GROUPS = SITE_HEADER_MENU;

export function normalizeSitePath(path: string) {
	return path.endsWith('/') ? path : `${path}/`;
}

export function isCurrentSitePath(currentPath: string, href: string) {
	return normalizeSitePath(currentPath) === normalizeSitePath(href);
}

export function groupContainsCurrentPath(
	currentPath: string,
	group: (typeof SITE_NAV_GROUPS)[number],
) {
	return group.items.some((item) => isCurrentSitePath(currentPath, item.href));
}
