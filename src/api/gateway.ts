import { Hono } from 'hono';
import { AgentSdk } from '@treeseed/sdk';
import { registerAgentRoutes } from './agent-routes.ts';
import { bearerTokenFromRequest, jsonError } from './http.ts';
import type { AppVariables, GatewayServerOptions } from './types.ts';

export function createTreeseedGatewayApp(options: GatewayServerOptions) {
	const sdk = options.sdk instanceof AgentSdk ? options.sdk : new AgentSdk();
	const app = new Hono<{ Variables: AppVariables }>();

	app.use('*', async (c, next) => {
		const token = bearerTokenFromRequest(c.req.raw);
		if (token !== options.bearerToken) {
			return jsonError(c, 401, 'Unauthorized gateway request.');
		}
		c.set('requestId', 'gateway');
		c.set('config', null as never);
		c.set('principal', null);
		c.set('actingUser', null);
		c.set('credential', null);
		c.set('actorType', 'service');
		c.set('permissionGrants', []);
		await next();
	});

	app.get('/healthz', (c) => c.json({ ok: true, service: 'treeseed-agent-gateway' }));

	registerAgentRoutes(app, {
		sdk,
		prefix: '',
		scope: null,
		projectId: options.projectId,
		queueProducer: options.queueProducer,
		defaultActor: 'gateway',
	});

	return app;
}
