import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class EcoHashApi implements ICredentialType {
  name = 'ecoHashApi';
  displayName = 'EcoHash API';
  documentationUrl = 'https://docs.ecohash.com/getting-started/api-keys';
  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      required: true,
      default: '',
      description:
        'Your EcoHash API key (starts with eco_). Create one at https://api.ecohash.com — new accounts include free starter credit.',
    },
  ];
  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: { Authorization: '=Bearer {{$credentials.apiKey}}' },
    },
  };
  test: ICredentialTestRequest = {
    request: { baseURL: 'https://api.ecohash.com/v1', url: '/models' },
  };
}
