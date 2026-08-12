import { describe, expect, it } from 'vitest';
import { EcoHashApi } from '../credentials/EcoHashApi.credentials';

describe('EcoHashApi credential', () => {
  const cred = new EcoHashApi();

  it('exposes a single password apiKey field', () => {
    expect(cred.name).toBe('ecoHashApi');
    expect(cred.properties).toHaveLength(1);
    expect(cred.properties[0].name).toBe('apiKey');
    expect(cred.properties[0].typeOptions?.password).toBe(true);
  });

  it('authenticates with a Bearer header', () => {
    expect(cred.authenticate.properties.headers?.Authorization).toBe('=Bearer {{$credentials.apiKey}}');
  });

  it('tests against GET /models', () => {
    expect(cred.test.request.baseURL).toBe('https://api.ecohash.com/v1');
    expect(cred.test.request.url).toBe('/models');
  });
});
