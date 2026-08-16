import { z } from 'astro/zod';
import { validatePortableContentData,type PortableContentModel } from '@treeseed/sdk/content-validation';

function inputField(field: string | undefined, value: unknown) {
	if (!field || !value || typeof value !== 'object' || Array.isArray(value)) return field;
	const [first, ...rest] = field.split('.');
	const camel = first!.replace(/_([a-z])/gu, (_, letter: string) => letter.toUpperCase());
	return camel !== first && Object.prototype.hasOwnProperty.call(value, camel) ? [camel, ...rest].join('.') : field;
}

function issuePath(field: string | undefined) {
	return field?.split('.').filter(Boolean).flatMap((segment) => {
		const parts = segment.split(/\[|\]/u).filter(Boolean);
		return parts.map((part) => /^\d+$/u.test(part) ? Number(part) : part);
	}) ?? [];
}

export function withPortableContentValidation<TSchema extends z.ZodTypeAny>(model: PortableContentModel, schema: TSchema) {
	return z.any().superRefine((value, context) => {
		const result = validatePortableContentData(model, value);
		for (const diagnostic of result.diagnostics) context.addIssue({
			code: z.ZodIssueCode.custom,
			path: issuePath(inputField(diagnostic.field, value)),
			message: diagnostic.message,
			params: { code: diagnostic.code, model },
		});
	}).pipe(schema);
}
