import { describe, expect, it, vi } from 'vitest';
import { ecohashRequest, loadModelOptions } from '../nodes/shared/ecohashApi';

function fakeCtx(response: unknown) {
  return {
    getCredentials: vi.fn().mockResolvedValue({ apiKey: 'eco_k' }),
    helpers: { httpRequest: vi.fn().mockResolvedValue(response) },
  };
}

describe('ecohashRequest', () => {
  it('sends bearer auth and json body to the right URL', async () => {
    const ctx = fakeCtx({ ok: true });
    const out = await ecohashRequest(ctx as never, 'POST', '/rerank', { model: 'm' });
    expect(out).toEqual({ ok: true });
    expect(ctx.helpers.httpRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: 'https://api.ecohash.com/v1/rerank',
      headers: { Authorization: 'Bearer eco_k' },
      body: { model: 'm' },
      json: true,
    });
  });
});

describe('loadModelOptions', () => {
  it('filters catalog by category and maps to options', async () => {
    const ctx = fakeCtx([
      { model_id: 'glm-5.2', display_name: 'GLM-5.2', category: 'llm' },
      { model_id: 'jina-embeddings-v3', display_name: 'Jina-Embeddings-V3', category: 'embedding' },
    ]);
    const opts = await loadModelOptions(ctx as never, ['embedding']);
    expect(opts).toEqual([{ name: 'Jina-Embeddings-V3', value: 'jina-embeddings-v3' }]);
    const call = ctx.helpers.httpRequest.mock.calls[0][0];
    expect(call.url).toContain('platform/models');
  });

  it('returns [] when the catalog is unreachable', async () => {
    const ctx = {
      getCredentials: vi.fn(),
      helpers: { httpRequest: vi.fn().mockRejectedValue(new Error('offline')) },
    };
    expect(await loadModelOptions(ctx as never, ['llm'])).toEqual([]);
  });
});
