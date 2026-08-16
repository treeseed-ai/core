import { workdayContentSchema } from '@treeseed/sdk/content-validation';

export function createWorkdayCollectionSchemas() {
	return { workdaySchema: workdayContentSchema };
}
