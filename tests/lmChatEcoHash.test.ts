import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@n8n/ai-node-sdk', () => ({
  supplyModel: vi.fn().mockResolvedValue({ response: 'MODEL' }),
}));

import { supplyModel } from '@n8n/ai-node-sdk';
import { LmChatEcoHash } from '../nodes/LmChatEcoHash/LmChatEcoHash.node';

function fakeSupplyCtx(params: Record<string, unknown>) {
  return {
    getCredentials: vi.fn().mockResolvedValue({ apiKey: 'eco_k' }),
    getNodeParameter: vi.fn((name: string) => params[name]),
    helpers: { httpRequest: vi.fn() },
  };
}

describe('LmChatEcoHash', () => {
  beforeEach(() => vi.clearAllMocks());

  it('declares an AiLanguageModel output and the EcoHash credential', () => {
    const node = new LmChatEcoHash();
    expect(node.description.outputs).toEqual(['ai_languageModel']);
    expect(node.description.inputs).toEqual([]);
    expect(node.description.credentials).toEqual([{ name: 'ecoHashApi', required: true }]);
    expect(node.description.name).toBe('lmChatEcoHash');
  });

  it('supplies an openai-compatible model config', async () => {
    const node = new LmChatEcoHash();
    const ctx = fakeSupplyCtx({ model: 'glm-5.2', temperature: 0.4 });
    const out = await node.supplyData.call(ctx as never, 0);
    expect(out).toEqual({ response: 'MODEL' });
    expect(supplyModel).toHaveBeenCalledWith(ctx, {
      type: 'openai',
      baseUrl: 'https://api.ecohash.com/v1',
      apiKey: 'eco_k',
      model: 'glm-5.2',
      temperature: 0.4,
    });
  });
});
