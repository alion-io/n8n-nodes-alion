// Runs the built node's execute() against https://alion.io without a key, through a stand-in for n8n's
// IExecuteFunctions (the parts the node uses). npm run build && node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Alion } = require('../dist/nodes/Alion/Alion.node.js');

function context(params, { continueOnFail = false, items = [{ json: {} }] } = {}) {
	return {
		getInputData: () => items,
		getNodeParameter: (name, i, fallback) => (name in params ? params[name] : fallback),
		getNode: () => ({ name: 'Alion', type: '@alion-io/n8n-nodes-alion.alion', typeVersion: 1, parameters: params }),
		continueOnFail: () => continueOnFail,
		helpers: {
			httpRequest: async (o) => {
				// (named a test run, so Alion's admin does not count CI as new users of the node)
				const headers = { ...o.headers, 'User-Agent': `${o.headers['User-Agent']} n8n-nodes-alion-tests` };
				const res = await fetch(o.url, { method: o.method, headers, body: JSON.stringify(o.body) });
				const body = await res.json();
				if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { httpCode: String(res.status), description: JSON.stringify(body) });
				return body;
			},
		},
	};
}

test('the User-Agent version follows package.json', async () => {
	const { readFileSync } = await import('node:fs');
	const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
	const src = readFileSync(new URL('../nodes/Alion/transport.ts', import.meta.url), 'utf8');
	assert.ok(src.includes(`const VERSION = '${pkg.version}';`));
});

const run = (params, opts) => new Alion().execute.call(context({ authentication: 'none', ...params }, opts));

test('company search: rows as items, limit honoured across pages', async () => {
	const [out] = await run({ resource: 'company', operation: 'search', query: 'stripe', returnAll: false, limit: 3, filters: {}, sort: {}, simplify: true });
	assert.equal(out.length, 3);
	assert.ok(out.some((r) => r.json.domain === 'stripe.com'));
	assert.deepEqual(out[0].pairedItem, { item: 0 });
});

test('company search with filters and a sort', async () => {
	const [out] = await run({ resource: 'company', operation: 'search', query: '', returnAll: false, limit: 5, filters: { country: 'DE', startup: true, industry: 'Fintech' }, sort: { order: 'recent_funding' }, simplify: true });
	assert.ok(out.length > 0 && out.length <= 5);
	assert.ok(out.every((r) => r.json.name));
});

test('job search, then the first posting in full', async () => {
	const [jobs] = await run({ resource: 'job', operation: 'search', query: 'engineer', returnAll: false, limit: 2, filters: { work_mode: 'remote' }, sort: {}, simplify: true });
	assert.equal(jobs.length, 2);
	const [one] = await run({ resource: 'job', operation: 'get', job: String(jobs[0].json.id), jobOptions: { max_chars: 500 } });
	assert.equal(one[0].json.id, jobs[0].json.id);
	assert.ok(one[0].json.title);
});

test('similar companies and resolve', async () => {
	const [similar] = await run({ resource: 'company', operation: 'getSimilar', company: 'stripe.com', similarLimit: 3, filters: {}, simplify: true });
	assert.ok(similar.length > 0 && similar.length <= 3);
	const [resolved] = await run({ resource: 'company', operation: 'resolve', company: 'openai.com' });
	assert.equal(resolved[0].json.match.name, 'OpenAI');
});

test('check a counterparty', async () => {
	const [out] = await run({ resource: 'company', operation: 'check', target: 'stripe.com' });
	assert.ok(out[0].json.verdict);
});

test('a paid operation without a key: a clear message, or an error item with continueOnFail', async () => {
	await assert.rejects(run({ resource: 'company', operation: 'get', company: 'stripe.com', simplify: true }), (e) => {
		assert.match(e.message, /paid/i);
		assert.match(e.description || '', /API key/);
		return true;
	});
	const [out] = await run({ resource: 'company', operation: 'get', company: 'stripe.com', simplify: true }, { continueOnFail: true });
	assert.match(out[0].json.error, /paid/i);
});
