import {
  NodeConnectionTypes,
  type ILoadOptionsFunctions,
  type INodePropertyOptions,
  type INodeType,
  type INodeTypeDescription,
  type ISupplyDataFunctions,
  type SupplyData,
} from 'n8n-workflow';
import { ecohashRequest, loadModelOptions } from '../shared/ecohashApi';

const BATCH_SIZE = 96;

export class EmbeddingsEcoHash implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Embeddings EcoHash',
    name: 'embeddingsEcoHash',
    icon: 'file:ecohash.svg',
    group: ['transform'],
    version: 1,
    description: 'Generate text embeddings with EcoHash models (Jina, Qwen3)',
    defaults: { name: 'Embeddings EcoHash' },
    codex: {
      categories: ['AI'],
      subcategories: { AI: ['Embeddings'] },
      resources: {
        primaryDocumentation: [{ url: 'https://docs.ecohash.com/platform-models/embeddings' }],
      },
    },
    inputs: [],
    outputs: [NodeConnectionTypes.AiEmbedding],
    outputNames: ['Embeddings'],
    credentials: [{ name: 'ecoHashApi', required: true }],
    properties: [
      {
        displayName: 'Model',
        name: 'model',
        type: 'options',
        typeOptions: { loadOptionsMethod: 'getModels' },
        default: 'jina-embeddings-v3',
        description: 'Embedding model from the EcoHash catalog',
      },
    ],
  };

  methods = {
    loadOptions: {
      async getModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const options = await loadModelOptions(this, ['embedding']);
        return options.length ? options : [{ name: 'Jina-Embeddings-V3', value: 'jina-embeddings-v3' }];
      },
    },
  };

  async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
    const self = this;
    const model = this.getNodeParameter('model', itemIndex) as string;

    async function embedBatch(input: string[]): Promise<number[][]> {
      const out = await ecohashRequest(self, 'POST', '/embeddings', { model, input });
      return (out.data as Array<{ index: number; embedding: number[] }>)
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);
    }

    const embedder = {
      embedQuery: async (text: string) => (await embedBatch([text]))[0],
      embedDocuments: async (texts: string[]) => {
        const vectors: number[][] = [];
        for (let i = 0; i < texts.length; i += BATCH_SIZE) {
          vectors.push(...(await embedBatch(texts.slice(i, i + BATCH_SIZE))));
        }
        return vectors;
      },
    };

    return { response: embedder };
  }
}
