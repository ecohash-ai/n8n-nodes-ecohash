import { describe, expect, it, vi } from 'vitest';
import { EcoHashReranker } from '../nodes/EcoHashReranker/EcoHashReranker.node';

function fakeSupplyCtx(params: Record<string, unknown>, rerankResponse: unknown) {
  return {
    getCredentials: vi.fn().mockResolvedValue({ apiKey: 'eco_k' }),
    getNodeParameter: vi.fn((name: string) => params[name]),
    getNode: vi.fn().mockReturnValue({ name: 'EcoHash Reranker' }),
    addInputData: vi.fn().mockReturnValue({ index: 0 }),
    addOutputData: vi.fn(),
    logger: { debug: vi.fn() },
    helpers: { httpRequest: vi.fn().mockResolvedValue(rerankResponse) },
  };
}

const DOCS = [
  { pageContent: 'solar panels convert light', metadata: { source: 'a' } },
  { pageContent: 'bananas are yellow', metadata: { source: 'b' } },
  { pageContent: 'photovoltaic cells explained', metadata: { source: 'c' } },
];

describe('EcoHashReranker', () => {
  it('declares an AiReranker output', () => {
    const node = new EcoHashReranker();
    expect(node.description.outputs).toEqual(['ai_reranker']);
    expect(node.description.name).toBe('ecoHashReranker');
  });

  it('reranks documents via /v1/rerank preserving metadata', async () => {
    const ctx = fakeSupplyCtx(
      { model: 'bge-reranker-v2-m3', topK: 2 },
      { results: [{ index: 2, relevance_score: 0.9 }, { index: 0, relevance_score: 0.7 }] },
    );
    const node = new EcoHashReranker();
    const { response } = (await node.supplyData.call(ctx as never, 0)) as { response: any };
    const ranked = await response.rerank({ query: 'how does solar work', documents: DOCS });
    expect(ranked.map((d: any) => d.metadata.source)).toEqual(['c', 'a']);
    expect(ranked[0]._rerankScore).toBe(0.9);
    const body = ctx.helpers.httpRequest.mock.calls[0][0].body;
    expect(body).toEqual({
      model: 'bge-reranker-v2-m3',
      query: 'how does solar work',
      documents: ['solar panels convert light', 'bananas are yellow', 'photovoltaic cells explained'],
      top_n: 2,
    });
  });

  it('compressDocuments strips helper fields for LangChain compatibility', async () => {
    const ctx = fakeSupplyCtx(
      { model: 'bge-reranker-v2-m3', topK: 10 },
      { results: [{ index: 1, relevance_score: 0.5 }] },
    );
    const node = new EcoHashReranker();
    const { response } = (await node.supplyData.call(ctx as never, 0)) as { response: any };
    const out = await response.compressDocuments(DOCS, 'q');
    expect(out).toEqual([{ pageContent: 'bananas are yellow', metadata: { source: 'b' } }]);
  });

  it('returns [] for empty documents without calling the API', async () => {
    const ctx = fakeSupplyCtx({ model: 'bge-reranker-v2-m3', topK: 3 }, {});
    const node = new EcoHashReranker();
    const { response } = (await node.supplyData.call(ctx as never, 0)) as { response: any };
    expect(await response.rerank({ query: 'q', documents: [] })).toEqual([]);
    expect(ctx.helpers.httpRequest).not.toHaveBeenCalled();
  });
});
