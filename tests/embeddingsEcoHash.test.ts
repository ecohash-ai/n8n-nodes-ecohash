import { describe, expect, it, vi } from 'vitest';
import { EmbeddingsEcoHash } from '../nodes/EmbeddingsEcoHash/EmbeddingsEcoHash.node';

function fakeSupplyCtx(params: Record<string, unknown>, impl: (opts: any) => unknown) {
  return {
    getCredentials: vi.fn().mockResolvedValue({ apiKey: 'eco_k' }),
    getNodeParameter: vi.fn((name: string) => params[name]),
    getNode: vi.fn(() => ({ name: 'Embeddings EcoHash', type: 'embeddingsEcoHash' })),
    addInputData: vi.fn(() => ({ index: 0 })),
    addOutputData: vi.fn(),
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

  it('logs embedQuery input and output to the execution log', async () => {
    const ctx = fakeSupplyCtx({ model: 'jina-embeddings-v3' }, () => ({
      data: [{ index: 0, embedding: [0.1, 0.2] }],
    }));
    const node = new EmbeddingsEcoHash();
    const { response } = (await node.supplyData.call(ctx as never, 0)) as { response: any };
    await response.embedQuery('hello');
    expect(ctx.addInputData).toHaveBeenCalledWith('ai_embedding', [
      [{ json: { query: 'hello' } }],
    ]);
    expect(ctx.addOutputData).toHaveBeenCalledWith('ai_embedding', 0, [
      [{ json: { response: [0.1, 0.2] } }],
    ]);
  });

  it('logs embedDocuments input and the full ordered output', async () => {
    const ctx = fakeSupplyCtx({ model: 'jina-embeddings-v3' }, (opts) => ({
      data: (opts.body.input as string[]).map((_t, i) => ({ index: i, embedding: [i] })),
    }));
    const node = new EmbeddingsEcoHash();
    const { response } = (await node.supplyData.call(ctx as never, 0)) as { response: any };
    await response.embedDocuments(['a', 'b']);
    expect(ctx.addInputData).toHaveBeenCalledWith('ai_embedding', [
      [{ json: { documents: ['a', 'b'] } }],
    ]);
    expect(ctx.addOutputData).toHaveBeenCalledWith('ai_embedding', 0, [
      [{ json: { response: [[0], [1]] } }],
    ]);
    // one log entry for the whole call, not one per 96-item batch
    expect(ctx.addInputData).toHaveBeenCalledTimes(1);
    expect(ctx.addOutputData).toHaveBeenCalledTimes(1);
  });

  it('logs the error and rethrows when the API call fails', async () => {
    const ctx = fakeSupplyCtx({ model: 'jina-embeddings-v3' }, () => {
      throw new Error('boom');
    });
    const node = new EmbeddingsEcoHash();
    const { response } = (await node.supplyData.call(ctx as never, 0)) as { response: any };
    await expect(response.embedQuery('hello')).rejects.toThrow('boom');
    expect(ctx.addOutputData).toHaveBeenCalledWith('ai_embedding', 0, [
      [{ json: { error: 'Error: boom' } }],
    ]);
  });

  it.each([
    ['', 'Cannot embed empty or undefined text'],
    [undefined, 'Cannot embed empty or undefined text'],
    [42, 'Cannot embed empty or undefined text'],
  ])('rejects invalid embedQuery input %p', async (bad, message) => {
    const ctx = fakeSupplyCtx({ model: 'jina-embeddings-v3' }, () => ({ data: [] }));
    const node = new EmbeddingsEcoHash();
    const { response } = (await node.supplyData.call(ctx as never, 0)) as { response: any };
    await expect(response.embedQuery(bad as never)).rejects.toThrow(message);
    // never reaches the API, and logs nothing
    expect(ctx.helpers.httpRequest).not.toHaveBeenCalled();
    expect(ctx.addInputData).not.toHaveBeenCalled();
  });

  it('rejects a non-array passed to embedDocuments', async () => {
    const ctx = fakeSupplyCtx({ model: 'jina-embeddings-v3' }, () => ({ data: [] }));
    const node = new EmbeddingsEcoHash();
    const { response } = (await node.supplyData.call(ctx as never, 0)) as { response: any };
    await expect(response.embedDocuments('not an array' as never)).rejects.toThrow(
      'Documents must be an array',
    );
    expect(ctx.helpers.httpRequest).not.toHaveBeenCalled();
  });

  it('reports which document index is empty', async () => {
    const ctx = fakeSupplyCtx({ model: 'jina-embeddings-v3' }, () => ({ data: [] }));
    const node = new EmbeddingsEcoHash();
    const { response } = (await node.supplyData.call(ctx as never, 0)) as { response: any };
    await expect(response.embedDocuments(['ok', '', 'also ok'])).rejects.toThrow(
      'Invalid document at index 1',
    );
    expect(ctx.helpers.httpRequest).not.toHaveBeenCalled();
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
