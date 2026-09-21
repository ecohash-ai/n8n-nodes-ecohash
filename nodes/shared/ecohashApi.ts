import type { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';

/**
 * OpenAI-compatible inference endpoint. Every model request made by this package
 * (chat completions via `supplyModel`) is sent here and nowhere else.
 */
export const ECOHASH_BASE_URL = 'https://api.ecohash.com/v1';

/** Public EcoHash model catalog, used only to populate the model dropdown. */
export const ECOHASH_CATALOG_URL = 'https://api.ecohash.com/platform/models';

interface CatalogEntry {
  model_id: string;
  display_name: string;
  category: string;
}

export async function loadModelOptions(
  ctx: ILoadOptionsFunctions,
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
