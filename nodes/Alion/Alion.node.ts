import {
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeProperties,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';

import {
	marketStatsFilters,
	searchCompaniesFilters,
	searchInvestorsFilters,
	searchJobsFilters,
	searchCompaniesSort,
	searchInvestorsSort,
	searchJobsSort,
	similarCompaniesFilters,
} from './filters.generated';
import { callTool, identify } from './transport';

// resource:operation -> the Alion tool it calls
const TOOL: Record<string, string> = {
	'company:search': 'search_companies',
	'company:get': 'get_company',
	'company:getSimilar': 'similar_companies',
	'company:resolve': 'resolve_company',
	'company:check': 'check_counterparty',
	'job:search': 'search_jobs',
	'job:get': 'get_job',
	'investor:search': 'search_investors',
	'investor:get': 'get_investor',
	'market:getStatistics': 'market_stats',
};

const PAGED = ['company:search', 'job:search', 'investor:search'];
const SERVER_PAGE = 50;

// the fields "Simplify" keeps of a full profile (at most 10)
const SIMPLE: Record<string, string[]> = {
	'company:get': ['id', 'name', 'domain', 'url', 'industry', 'size_band', 'founded_year', 'hq_country', 'open_jobs', 'funding'],
	'investor:get': ['id', 'name', 'domain', 'url', 'type', 'hq_country', 'portfolio', 'portfolio_rounds_90d', 'led_rounds_12m', 'status'],
};

const show = (resource: string, operation: string[]) => ({ show: { resource: [resource], operation } });

function filters(resource: string, operation: string, options: INodeProperties[]): INodeProperties {
	return {
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show(resource, [operation]),
		options,
	};
}

function sortCollection(resource: string, sort: INodeProperties): INodeProperties {
	return { ...sort, displayOptions: show(resource, ['search']) };
}

function paging(resource: string): INodeProperties[] {
	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			displayOptions: show(resource, ['search']),
			default: false,
			description: 'Whether to return all results or only up to a given limit',
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			displayOptions: { show: { resource: [resource], operation: ['search'], returnAll: [false] } },
			typeOptions: { minValue: 1, maxValue: 100 },
			default: 50,
			description: 'Max number of results to return',
		},
	];
}

function simplify(resource: string, operations: string[]): INodeProperties {
	return {
		displayName: 'Simplify',
		name: 'simplify',
		type: 'boolean',
		default: true,
		displayOptions: show(resource, operations),
		description: 'Whether to return a simplified version of the response instead of the raw data',
	};
}

export class Alion implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Alion',
		name: 'alion',
		icon: { light: 'file:../../icons/alion.svg', dark: 'file:../../icons/alion.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Companies, startups, investors, job postings and pay statistics from Alion',
		defaults: { name: 'Alion' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'alionApi', required: true, displayOptions: { show: { authentication: ['apiKey'] } } }],
		properties: [
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				options: [
					{ name: 'None (Free Open Address)', value: 'none' },
					{ name: 'API Key', value: 'apiKey' },
				],
				default: 'none',
				description: 'Without a key: compact company and job searches, lookalikes, job postings and checks, free within a daily allowance. With a key: full profiles, investors and pay statistics.',
			},
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Company', value: 'company' },
					{ name: 'Investor', value: 'investor' },
					{ name: 'Job', value: 'job' },
					{ name: 'Market', value: 'market' },
				],
				default: 'company',
			},

			// operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['company'] } },
				options: [
					{ name: 'Check', value: 'check', action: 'Check a company or counterparty', description: 'Check whether a domain, site, email or agent is a real, verified counterparty' },
					{ name: 'Get', value: 'get', action: 'Get a company', description: 'Get the full profile of a company: funding, hiring, stack, offices, visa' },
					{ name: 'Get Similar', value: 'getSimilar', action: 'Get similar companies', description: 'Get companies like a given company' },
					{ name: 'Resolve', value: 'resolve', action: 'Resolve a company', description: 'Find which company a name or a domain means' },
					{ name: 'Search', value: 'search', action: 'Search companies', description: 'Search companies by industry, country, size, funding, technology and hiring' },
				],
				default: 'search',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['job'] } },
				options: [
					{ name: 'Get', value: 'get', action: 'Get a job posting', description: 'Get one job posting in full' },
					{ name: 'Search', value: 'search', action: 'Search job postings', description: 'Search verified job postings by role, country, work mode, pay and technology' },
				],
				default: 'search',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['investor'] } },
				options: [
					{ name: 'Get', value: 'get', action: 'Get an investor', description: 'Get the profile of a fund, accelerator or angel network' },
					{ name: 'Search', value: 'search', action: 'Search investors', description: 'Search funds, accelerators and angels by stage, sector, geography and activity' },
				],
				default: 'search',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['market'] } },
				options: [
					{ name: 'Get Statistics', value: 'getStatistics', action: 'Get hiring and pay statistics', description: 'Get demand, pay percentiles, top employers and technologies of a role in a country' },
				],
				default: 'getStatistics',
			},
			{
				displayName: 'This operation needs an Alion API key: set Authentication to API Key',
				name: 'keyNoticeCompany',
				type: 'notice',
				default: '',
				displayOptions: { show: { authentication: ['none'], resource: ['company'], operation: ['get'] } },
			},
			{
				displayName: 'This operation needs an Alion API key: set Authentication to API Key',
				name: 'keyNoticeInvestor',
				type: 'notice',
				default: '',
				displayOptions: { show: { authentication: ['none'], resource: ['investor'] } },
			},
			{
				displayName: 'This operation needs an Alion API key: set Authentication to API Key',
				name: 'keyNoticeMarket',
				type: 'notice',
				default: '',
				displayOptions: { show: { authentication: ['none'], resource: ['market'] } },
			},

			// company
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				default: '',
				placeholder: 'e.g. acme',
				displayOptions: show('company', ['search']),
				description: 'Name prefix ("Acme") or domain prefix ("acme."); leave empty to search by filters only',
			},
			...paging('company'),
			filters('company', 'search', searchCompaniesFilters),
			sortCollection('company', searchCompaniesSort),
			{
				displayName: 'Company',
				name: 'company',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'e.g. stripe.com',
				displayOptions: show('company', ['get', 'getSimilar', 'resolve']),
				description: 'The company domain (most exact), any URL on its site, its name or its Alion ID',
			},
			{
				displayName: 'Limit',
				name: 'similarLimit',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 25 },
				default: 10,
				displayOptions: show('company', ['getSimilar']),
				description: 'Max number of results to return',
			},
			filters('company', 'getSimilar', similarCompaniesFilters),
			{
				displayName: 'Target',
				name: 'target',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'e.g. acme.com',
				displayOptions: show('company', ['check']),
				description: 'A domain, a URL (a site, an MCP or A2A endpoint), an email address or a wallet address',
			},
			simplify('company', ['search', 'get', 'getSimilar']),

			// job
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				default: '',
				placeholder: 'e.g. python backend kubernetes',
				displayOptions: show('job', ['search']),
				description: 'Words over titles and descriptions; leave empty to search by filters only',
			},
			...paging('job'),
			filters('job', 'search', searchJobsFilters),
			sortCollection('job', searchJobsSort),
			{
				displayName: 'Job',
				name: 'job',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'e.g. https://alion.io/job/...',
				displayOptions: show('job', ['get']),
				description: 'The Alion job ID, its alion.io link or the original posting URL',
			},
			{
				displayName: 'Options',
				name: 'jobOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: show('job', ['get']),
				options: [
					{
						displayName: 'Description Format',
						name: 'description_format',
						type: 'options',
						options: [
							{ name: 'HTML', value: 'html' },
							{ name: 'Plain Text', value: 'text' },
						],
						default: 'text',
						description: "The posting description as plain text or as the employer's HTML",
					},
					{
						displayName: 'Max Characters',
						name: 'max_chars',
						type: 'number',
						typeOptions: { minValue: 200, maxValue: 12000 },
						default: 12000,
						description: 'Cut the plain-text description to this many characters',
					},
				],
			},
			simplify('job', ['search']),

			// investor
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				default: '',
				placeholder: 'e.g. sequoia',
				displayOptions: show('investor', ['search']),
				description: "Words of the investor's name; leave empty to search by filters only",
			},
			...paging('investor'),
			filters('investor', 'search', searchInvestorsFilters),
			sortCollection('investor', searchInvestorsSort),
			{
				displayName: 'Investor',
				name: 'investor',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'e.g. sequoiacap.com',
				displayOptions: show('investor', ['get']),
				description: 'The investor domain, any URL on its site, its name or its Alion ID',
			},
			simplify('investor', ['search', 'get']),

			// market
			{
				displayName: 'Role',
				name: 'role',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'e.g. Data Engineer',
				displayOptions: show('market', ['getStatistics']),
				description: 'A role or role family by name',
			},
			{
				displayName: 'Country',
				name: 'country',
				type: 'string',
				default: '',
				placeholder: 'e.g. DE',
				displayOptions: show('market', ['getStatistics']),
				description: 'ISO 3166-1 alpha-2 code or country name; leave empty for the whole world',
			},
			filters('market', 'getStatistics', marketStatsFilters),
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const key = `${resource}:${operation}`;
				const tool = TOOL[key];
				const args = buildArgs.call(this, i, key);

				if (PAGED.includes(key)) {
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					const max = returnAll ? Infinity : (this.getNodeParameter('limit', i) as number);
					let cursor: string | undefined;
					let seen = 0;
					for (;;) {
						const want = Math.min(SERVER_PAGE, max - seen);
						const page = await callTool.call(this, i, tool, { ...args, limit: want, ...(cursor ? { cursor } : {}) });
						const rows = (page.items as IDataObject[]) ?? [];
						for (const row of rows) {
							out.push({ json: row, pairedItem: { item: i } });
							if (++seen >= max) break;
						}
						cursor = page.next_cursor as string | undefined;
						if (seen >= max || !cursor || page.has_more === false || rows.length === 0) break;
					}
					continue;
				}

				const result = await callTool.call(this, i, tool, args);
				if (key === 'company:getSimilar') {
					for (const row of (result.items as IDataObject[]) ?? []) out.push({ json: row, pairedItem: { item: i } });
					continue;
				}
				let json = result;
				if (SIMPLE[key] && (this.getNodeParameter('simplify', i) as boolean)) {
					json = {};
					for (const f of SIMPLE[key]) if (result[f] !== undefined) json[f] = result[f];
				}
				out.push({ json, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}
		return [out];
	}
}

function buildArgs(this: IExecuteFunctions, i: number, key: string): IDataObject {
	const param = (name: string, fallback: unknown = undefined) => this.getNodeParameter(name, i, fallback);
	const compact = () => ((param('simplify', true) as boolean) ? 'compact' : 'standard');
	const sortOrder = () => ((param('sort', {}) as IDataObject).order as string | undefined);
	switch (key) {
		case 'company:search':
		case 'job:search':
		case 'investor:search':
			return { query: param('query', ''), ...(param('filters', {}) as IDataObject), sort: sortOrder(), detail: compact() };
		case 'company:get':
			return identify(param('company') as string);
		case 'company:getSimilar':
			return { company: (param('company') as string).trim(), limit: param('similarLimit', 10), ...(param('filters', {}) as IDataObject), detail: compact() };
		case 'company:resolve':
			return { query: (param('company') as string).trim() };
		case 'company:check':
			return { target: (param('target') as string).trim() };
		case 'job:get':
			return { ...identify(param('job') as string, false), ...(param('jobOptions', {}) as IDataObject) };
		case 'investor:get':
			return identify(param('investor') as string);
		case 'market:getStatistics':
			return { role: param('role'), country: param('country', ''), ...(param('filters', {}) as IDataObject) };
		default:
			return {};
	}
}

