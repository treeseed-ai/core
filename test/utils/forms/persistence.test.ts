import { describe, expect, it } from 'vitest';
import type { D1DatabaseLike, D1PreparedStatementLike } from '../../../src/types/cloudflare';
import { createContactSubmission } from '../../../src/utils/forms/contact-submissions';
import { upsertSubscriber } from '../../../src/utils/forms/subscribers';

interface RecordedStatement {
	query: string;
	bindings: unknown[];
}

class TestStatement implements D1PreparedStatementLike {
	private bindings: unknown[] = [];

	constructor(
		private readonly db: TestD1,
		private readonly query: string,
	) {}

	bind(...values: unknown[]) {
		this.bindings = values;
		return this;
	}

	async run() {
		this.db.record(this.query, this.bindings);
		return {};
	}

	async first<T = Record<string, unknown>>() {
		this.db.record(this.query, this.bindings);
		if (this.query.includes('sqlite_master')) {
			const tableName = this.query.includes('name = ?') ? String(this.bindings[0] ?? '') : this.query.match(/name = '([^']+)'/)?.[1] ?? '';
			return (this.db.hasTable(tableName) ? { name: tableName } : null) as T | null;
		}
		return null;
	}

	async all<T = Record<string, unknown>>() {
		this.db.record(this.query, this.bindings);
		const tableName = this.query.match(/PRAGMA table_info\(([^)]+)\)/)?.[1] ?? '';
		return {
			results: this.db.columns(tableName).map((name) => ({ name }) as T),
		};
	}

	async raw<T = unknown[]>() {
		return [] as T[];
	}
}

class TestD1 implements D1DatabaseLike {
	statements: RecordedStatement[] = [];

	constructor(private readonly schema: Record<string, string[]>) {}

	prepare(query: string) {
		return new TestStatement(this, query);
	}

	record(query: string, bindings: unknown[]) {
		this.statements.push({ query, bindings });
	}

	hasTable(tableName: string) {
		return tableName in this.schema;
	}

	columns(tableName: string) {
		return this.schema[tableName] ?? [];
	}

	lastWrite() {
		return [...this.statements].reverse().find((statement) => /^INSERT|^UPDATE/u.test(statement.query.trim()));
	}
}

describe('form persistence schema compatibility', () => {
	it('stores subscriptions in the legacy subscribers table when newer tables are absent', async () => {
		const db = new TestD1({ subscribers: ['email', 'created_at'] });

		await upsertSubscriber(db, {
			email: 'reader@example.com',
			name: '',
			source: 'footer',
			ip: '127.0.0.1',
		});

		const write = db.lastWrite();
		expect(write?.query).toContain('INSERT INTO subscribers');
		expect(write?.bindings[0]).toBe('reader@example.com');
	});

	it('stores contact submissions in the legacy contact table shape when newer columns are absent', async () => {
		const db = new TestD1({ contact_submissions: ['id', 'email', 'message', 'created_at'] });

		await createContactSubmission(db, {
			name: 'Ada Lovelace',
			email: 'ada@example.com',
			organization: 'Analytical Engines Ltd',
			contactType: 'collaboration',
			subject: 'Working together',
			message: 'Can we talk?',
			ip: '127.0.0.1',
			userAgent: 'test',
		});

		const write = db.lastWrite();
		expect(write?.query).toContain('INSERT INTO contact_submissions');
		expect(write?.query).not.toContain('contact_type');
		expect(write?.bindings[0]).toBe('ada@example.com');
		expect(String(write?.bindings[1])).toContain('Working together');
		expect(String(write?.bindings[1])).toContain('Can we talk?');
	});
});
