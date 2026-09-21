import { describe, expect, it, vi } from 'vitest';
import { ECOHASH_BASE_URL, ECOHASH_CATALOG_URL, loadModelOptions } from '../nodes/shared/ecohashApi';

describe('EcoHash endpoints', () => {
  it('send inference and catalog requests to the EcoHash API only', () => {
    expect(ECOHASH_BASE_URL).toBe('https://api.ecohash.com/v1');
    expect(ECOHASH_CATALOG_URL).toBe('https://api.ecohash.com/platform/models');
  });
});

describe('loadModelOptions', () => {
  it('filters the catalog by category and maps entries to options', async () => {
    const ctx = {
      helpers: {
        httpRequest: vi.fn().mockResolvedValue([
          { model_id: 'GLM-5.2', display_name: 'GLM-5.2', category: 'llm' },
          { model_id: 'qwen3-vl', display_name: 'Qwen3-VL', category: 'llm_vision' },
          { model_id: 'jina-embeddings-v3', display_name: 'Jina-Embeddings-V3', category: 'embedding' },
        ]),
      },
    };
    const opts = await loadModelOptions(ctx as never, ['llm', 'llm_vision']);
    expect(opts).toEqual([
      { name: 'GLM-5.2', value: 'GLM-5.2' },
      { name: 'Qwen3-VL', value: 'qwen3-vl' },
    ]);
    const call = ctx.helpers.httpRequest.mock.calls[0][0];
    expect(call.url).toBe('https://api.ecohash.com/platform/models?status=active');
  });

  it('returns [] when the catalog is unreachable', async () => {
    const ctx = {
      helpers: { httpRequest: vi.fn().mockRejectedValue(new Error('offline')) },
    };
    expect(await loadModelOptions(ctx as never, ['llm'])).toEqual([]);
  });
});
