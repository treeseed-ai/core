import { cedarScheme } from './cedar.ts';
import { fernScheme } from './fern.ts';
import { lichenScheme } from './lichen.ts';
import { tidepoolScheme } from './tidepool.ts';

export const BUILT_IN_COLOR_SCHEMES = [
	fernScheme,
	lichenScheme,
	cedarScheme,
	tidepoolScheme,
] as const;
