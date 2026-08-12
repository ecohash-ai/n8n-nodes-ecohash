import {
  NodeConnectionTypes,
  NodeOperationError,
  type ILoadOptionsFunctions,
  type INodePropertyOptions,
  type INodeType,
  type INodeTypeDescription,
  type ISupplyDataFunctions,
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
    icon: 'file:ecohash.svg',
    group: ['transform'],
    version: 1,
    description: 'Rerank retrieved documents by relevance using EcoHash BGE reranker models',
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
        displayName: 'Model',
        name: 'model',
        type: 'options',
        typeOptions: { loadOptionsMethod: 'getModels' },
        default: 'bge-reranker-v2-m3',
        description: 'Reranker model from the EcoHash catalog',
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

          const ranked = (out.results as Array<{ index: number; relevance_score: number }>).map((r) => ({
            pageContent: normalized[r.index].pageContent,
            metadata: normalized[r.index].metadata,
            _rerankScore: r.relevance_score,
          }));

          self.addOutputData(NodeConnectionTypes.AiReranker, index, [[{ json: { response: ranked } }]]);
          return ranked;
        } catch (error) {
          self.addOutputData(NodeConnectionTypes.AiReranker, index, [[{ json: { error: String(error) } }]]);
          throw error;
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
