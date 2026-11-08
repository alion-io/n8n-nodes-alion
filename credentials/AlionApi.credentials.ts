import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class AlionApi implements ICredentialType {
	name = 'alionApi';

	displayName = 'Alion API';

	icon: Icon = { light: 'file:../icons/alion.svg', dark: 'file:../icons/alion.dark.svg' };

	documentationUrl = 'https://github.com/alion-io/n8n-nodes-alion#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'A key from https://alion.io/developers/keys. Calls are paid from the credits of the account behind it.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	// a key that the server does not know answers 401 here
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://alion.io',
			url: '/mcp',
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
		},
	};
}
