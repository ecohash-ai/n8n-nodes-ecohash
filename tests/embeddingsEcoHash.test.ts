import { describe, expect, it, vi } from 'vitest';
import { EmbeddingsEcoHash } from '../nodes/EmbeddingsEcoHash/EmbeddingsEcoHash.node';

function fakeSupplyCtx(params: Record<string, unknown>, impl: (opts: any) => unknown) {
  return {
    getCredentials: vi.fn().mockResolvedValue({ apiKey: 'eco_k' }),
    getNodeParameter: vi.fn((name: string) => params[name]),
    helpers: { httpRequest: vi.fn().mockImplementation(async (opts) => impl(opts)) },
  };
}

describe('EmbeddingsEcoHash', () => {
  it('declares an AiEmbedding output', () => {
    const node = new EmbeddingsEcoHash();
    expect(node.description.outputs).toEqual(['ai_embedding']);
  });

  it('embedQuery returns a single vector', async () => {
    const ctx = fakeSupplyCtx({ model: 'jina-embeddings-v3' }, () => ({
      data: [{ index: 0, embedding: [0.1, 0.2] }],
    }));
    const node = new EmbeddingsEcoHash();
    const { response } = (await node.supplyData.call(ctx as never, 0)) as { response: any };
    expect(await response.embedQuery('hello')).toEqual([0.1, 0.2]);
    const body = ctx.helpers.httpRequest.mock.calls[0][0].body;
    expect(body).toEqual({ model: 'jina-embeddings-v3', input: ['hello'] });
  });

  it('embedDocuments batches at 96 and restores order', async () => {
    const ctx = fakeSupplyCtx({ model: 'jina-embeddings-v3' }, (opts) => ({
      // return reversed order to prove we sort by index
      data: (opts.body.input as string[])
        .map((_t, i) => ({ index: i, embedding: [i] }))
        .reverse(),
    }));
    const node = new EmbeddingsEcoHash();
    const { response } = (await node.supplyData.call(ctx as never, 0)) as { response: any };
    const texts = Array.from({ length: 100 }, (_v, i) => `t${i}`);
    const vectors = await response.embedDocuments(texts);
    expect(vectors).toHaveLength(100);
    expect(vectors[0]).toEqual([0]);
    expect(vectors[97]).toEqual([1]); // second batch, local index 1
    expect(ctx.helpers.httpRequest).toHaveBeenCalledTimes(2);
    expect(ctx.helpers.httpRequest.mock.calls[0][0].body.input).toHaveLength(96);
    expect(ctx.helpers.httpRequest.mock.calls[1][0].body.input).toHaveLength(4);
  });

  it('honors per-item index when resolving model parameter', async () => {
    const ctx = fakeSupplyCtx({ model: 'jina-embeddings-v3' }, () => ({
      data: [{ index: 0, embedding: [0.5] }],
    }));
    const node = new EmbeddingsEcoHash();
    await node.supplyData.call(ctx as never, 3);
    expect(ctx.getNodeParameter).toHaveBeenCalledWith('model', 3);
  });
});
