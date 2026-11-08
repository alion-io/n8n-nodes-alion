import {
	NodeApiError,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type IHttpRequestOptions,
	type JsonObject,
} from 'n8n-workflow';

export const BASE_URL = 'https://alion.io';
const VERSION = '0.1.0';

/**
 * Calls one Alion tool: a stateless JSON-RPC tools/call on the MCP endpoint. Without credentials the free open
 * address (/mcp/open), with an API key the full server (/mcp).
 */
export async function callTool(
	this: IExecuteFunctions,
	itemIndex: number,
	tool: string,
	args: IDataObject,
): Promise<IDataObject> {
	const authentication = this.getNodeParameter('authentication', itemIndex) as string;
	const withKey = authentication === 'apiKey';
	const options: IHttpRequestOptions = {
		method: 'POST',
		url: `${BASE_URL}${withKey ? '/mcp' : '/mcp/open'}`,
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
			'MCP-Protocol-Version': '2025-11-25',
			'User-Agent': `n8n-nodes-alion/${VERSION}`,
		},
		body: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: clean(args) } },
		json: true,
	};

	let response: IDataObject;
	try {
		response = withKey
			? ((await this.helpers.httpRequestWithAuthentication.call(this, 'alionApi', options)) as IDataObject)
			: ((await this.helpers.httpRequest(options)) as IDataObject);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
	}

	if (response.error) {
		const rpc = response.error as IDataObject;
		throw new NodeOperationError(this.getNode(), String(rpc.message ?? 'Alion refused the request'), { itemIndex });
	}
	const result = (response.result ?? {}) as IDataObject;
	const payload = (result.structuredContent ?? parseText(result.content)) as IDataObject;
	if (result.isError) {
		const code = String(payload?.error ?? '');
		const message = String(payload?.message ?? `${tool} refused the request`);
		const description =
			code === 'account_required' || code === 'payment_required'
				? "This operation needs an Alion API key: create one at https://alion.io/developers/keys, then set 'Authentication' to 'API Key'"
				: code === 'rate_limited'
					? 'Too many calls in a short time. Wait a minute, or add an API key for higher limits'
					: undefined;
		throw new NodeOperationError(this.getNode(), message, { itemIndex, description });
	}
	return payload ?? {};
}

function clean(args: IDataObject): IDataObject {
	const out: IDataObject = {};
	for (const [k, v] of Object.entries(args)) if (v !== undefined && v !== null && v !== '') out[k] = v;
	return out;
}

function parseText(content: unknown): unknown {
	if (!Array.isArray(content)) return undefined;
	const text = (content as IDataObject[]).find((c) => c.type === 'text')?.text;
	if (typeof text !== 'string') return undefined;
	try {
		return JSON.parse(text);
	} catch {
		return { text };
	}
}

/** How a company, investor or job was named by the user: an Alion id, a url, a domain or a name. */
export function identify(value: string, allowName = true): IDataObject {
	const v = value.trim();
	if (/^\d+$/.test(v)) return { id: Number(v) };
	if (/^https?:\/\//i.test(v)) return { url: v };
	if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(v)) return { domain: v.toLowerCase() };
	return allowName ? { name: v } : { url: v };
}
