import starlight from '@astrojs/starlight';
import { createTreeseedSite } from '@treeseed/core/site';
import { loadTreeseedManifest } from '@treeseed/core/tenant-config';

const tenant = loadTreeseedManifest();

export default createTreeseedSite(tenant, { starlight });
