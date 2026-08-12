import type {
  IHttpRequestMethods,
  INodePropertyOptions,
  ILoadOptionsFunctions,
  ISupplyDataFunctions,
} from 'n8n-workflow';

export const ECOHASH_BASE_URL = 'https://api.ecohash.com/v1';
export const ECOHASH_CATALOG_URL = 'https://api.ecohash.com/platform/models';

type RequestContext = Pick<ISupplyDataFunctions, 'getCredentials' | 'helpers'> | ILoadOptionsFunctions;

export async function ecohashRequest(
  ctx: RequestContext,
  method: IHttpRequestMethods,
  path: string,
  body?: object,
): Promise<any> {
  const credentials = (await ctx.getCredentials('ecoHashApi')) as { apiKey: string };
  return await ctx.helpers.httpRequest({
    method,
    url: `${ECOHASH_BASE_URL}${path}`,
    headers: { Authorization: `Bearer ${credentials.apiKey}` },
    body,
    json: true,
  });
}

interface CatalogEntry {
  model_id: string;
  display_name: string;
  category: string;
}

export async function loadModelOptions(
  ctx: RequestContext,
  categories: string[],
): Promise<INodePropertyOptions[]> {
  try {
    const catalog = (await ctx.helpers.httpRequest({
      method: 'GET',
      url: `${ECOHASH_CATALOG_URL}?status=active`,
      json: true,
    })) as CatalogEntry[];
    return catalog
      .filter((m) => categories.includes(m.category))
      .map((m) => ({ name: m.display_name, value: m.model_id }));
  } catch {
    return [];
  }
}
