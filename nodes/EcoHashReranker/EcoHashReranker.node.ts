import {
  NodeApiError,
  NodeConnectionTypes,
  NodeOperationError,
  type ILoadOptionsFunctions,
  type INodePropertyOptions,
  type INodeType,
  type INodeTypeDescription,
  type ISupplyDataFunctions,
  type JsonObject,
  type SupplyData,
} from 'n8n-workflow';
import { ecohashRequest, loadModelOptions } from '../shared/ecohashApi';

interface RerankInput {
  query: string;
  documents: Array<{ pageContent?: string; metadata?: object } | string>;
  topN?: number;
}

export class EcoHashReranker implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'EcoHash Reranker',
    name: 'ecoHashReranker',
    icon: { light: 'file:ecohash.svg', dark: 'file:ecohash.dark.svg' },
    group: ['transform'],
    version: 1,
    description: 'Rerank retrieved documents by relevance using EcoHash BGE reranker models',
    subtitle: '={{$parameter["model"]}}',
    defaults: { name: 'EcoHash Reranker' },
    codex: {
      categories: ['AI'],
      subcategories: { AI: ['Rerankers'] },
      resources: {
        primaryDocumentation: [{ url: 'https://docs.ecohash.com/platform-models/reranker' }],
      },
    },
    inputs: [],
    outputs: [NodeConnectionTypes.AiReranker],
    outputNames: ['Reranker'],
    credentials: [{ name: 'ecoHashApi', required: true }],
    properties: [
      {
        displayName: 'Model Name or ID',
        name: 'model',
        type: 'options',
        typeOptions: { loadOptionsMethod: 'getModels' },
        default: 'bge-reranker-v2-m3',
        description:
          'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
      },
      {
        displayName: 'Top K',
        name: 'topK',
        type: 'number',
        typeOptions: { minValue: 1 },
        default: 3,
        description: 'Maximum number of documents to return after reranking',
      },
    ],
  };

  methods = {
    loadOptions: {
      async getModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const options = await loadModelOptions(this, ['reranker']);
        return options.length ? options : [{ name: 'BGE-Reranker-V2-M3', value: 'bge-reranker-v2-m3' }];
      },
    },
  };

  async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
    const self = this;

    const provider = {
      name: 'EcoHash Reranker',

      rerank: async (input: RerankInput) => {
        const { query, documents } = input;
        if (!query?.trim()) {
          throw new NodeOperationError(self.getNode(), 'Reranker query cannot be empty');
        }
        const docs = Array.isArray(documents) ? documents : [];
        if (!docs.length) return [];

        const { index } = self.addInputData(NodeConnectionTypes.AiReranker, [
          [{ json: { query, documents: docs } }],
        ]);

        try {
          const model = self.getNodeParameter('model', itemIndex) as string;
          const topN = input.topN ?? (self.getNodeParameter('topK', itemIndex) as number);
          const normalized = docs.map((doc, i) =>
            typeof doc === 'string'
              ? { pageContent: doc, metadata: {}, _originalIndex: i }
              : { pageContent: doc.pageContent ?? JSON.stringify(doc), metadata: doc.metadata ?? {}, _originalIndex: i },
          );

          const out = await ecohashRequest(self, 'POST', '/rerank', {
            model,
            query,
            documents: normalized.map((d) => d.pageContent),
            top_n: topN,
          });

          const results = out?.results as
            | Array<{ index: number; relevance_score: number }>
            | undefined;
          if (!Array.isArray(results)) {
            throw new NodeOperationError(
              self.getNode(),
              'Unexpected response from the EcoHash rerank API',
              {
                description: `Expected a "results" array. Got: ${JSON.stringify(out).slice(0, 200)}`,
              },
            );
          }
          // r.index points back into the documents we sent. A value outside that range
          // would otherwise surface as "Cannot read properties of undefined".
          const ranked = results.map((r) => {
            const doc = normalized[r.index];
            if (!doc) {
              throw new NodeOperationError(
                self.getNode(),
                `EcoHash rerank returned index ${r.index}, which is outside the ${normalized.length} documents sent`,
              );
            }
            return {
              pageContent: doc.pageContent,
              metadata: doc.metadata,
              _rerankScore: r.relevance_score,
            };
          });

          self.addOutputData(NodeConnectionTypes.AiReranker, index, [[{ json: { response: ranked } }]]);
          return ranked;
        } catch (error) {
          self.addOutputData(NodeConnectionTypes.AiReranker, index, [[{ json: { error: String(error) } }]]);
          // Validation failures above are already NodeOperationError — rethrown as-is
          // (the constructor short-circuits back to the same instance). Anything else
          // is a raw failure from the API call itself, so wrap it for HTTP context.
          if (error instanceof NodeOperationError) {
            throw new NodeOperationError(self.getNode(), error);
          }
          throw new NodeApiError(self.getNode(), error as JsonObject);
        }
      },

      compressDocuments: async (documents: RerankInput['documents'], query: string, topN?: unknown) => {
        const limit = typeof topN === 'number' ? topN : undefined;
        const ranked = await provider.rerank({ query, documents, topN: limit });
        return ranked.map(({ _rerankScore, ...doc }: { _rerankScore: number }) => doc);
      },
    };

    return { response: provider };
  }
}
