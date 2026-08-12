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

const BATCH_SIZE = 96;

// n8n instruments its own embedders by passing them through `logWrapper`, which both
// validates the input and writes the ai_embedding run to the execution log. That helper
// only applies its embeddings branch to `instanceof Embeddings`, so it cannot wrap the
// plain object returned below — and reaching for it would add a dependency on an
// internal package. The two behaviours are reproduced here with n8n-workflow primitives
// instead, matching @n8n/ai-utilities' validateEmbedQueryInput / validateEmbedDocumentsInput.

function validateQuery(ctx: ISupplyDataFunctions, query: unknown): string {
  if (typeof query !== 'string' || query === '') {
    throw new NodeOperationError(ctx.getNode(), 'Cannot embed empty or undefined text', {
      description:
        'The text provided for embedding is empty or undefined. This can happen when: the input expression evaluates to undefined, the AI agent calls a tool without proper arguments, or a required field is missing.',
    });
  }
  return query;
}

function validateDocuments(ctx: ISupplyDataFunctions, documents: unknown): string[] {
  if (!Array.isArray(documents)) {
    throw new NodeOperationError(ctx.getNode(), 'Documents must be an array', {
      description: 'Expected an array of strings to embed.',
    });
  }
  const invalidIndex = documents.findIndex(
    (doc) => doc === undefined || doc === null || doc === '',
  );
  if (invalidIndex !== -1) {
    throw new NodeOperationError(ctx.getNode(), `Invalid document at index ${invalidIndex}`, {
      description: `Document at index ${invalidIndex} is empty or undefined. All documents must be non-empty strings.`,
    });
  }
  return documents as string[];
}

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
      const data = out?.data as Array<{ index: number; embedding: number[] }> | undefined;
      if (!Array.isArray(data)) {
        throw new NodeOperationError(
          self.getNode(),
          'Unexpected response from the EcoHash embeddings API',
          {
            description: `Expected a "data" array of embeddings. Got: ${JSON.stringify(out).slice(0, 200)}`,
          },
        );
      }
      // Consumers pair vectors to documents by position, so a short response would
      // silently attach the wrong vector to a document — worse than failing here.
      if (data.length !== input.length) {
        throw new NodeOperationError(
          self.getNode(),
          `EcoHash returned ${data.length} embeddings for ${input.length} inputs`,
          {
            description:
              'Vectors are matched to documents by position, so a count mismatch would corrupt the index. Retry the request; if it persists, report it with the model name.',
          },
        );
      }
      return data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
    }

    const embedder = {
      embedQuery: async (text: string) => {
        const query = validateQuery(self, text);
        const { index } = self.addInputData(NodeConnectionTypes.AiEmbedding, [
          [{ json: { query } }],
        ]);
        try {
          const response = (await embedBatch([query]))[0];
          self.addOutputData(NodeConnectionTypes.AiEmbedding, index, [
            [{ json: { response } }],
          ]);
          return response;
        } catch (error) {
          self.addOutputData(NodeConnectionTypes.AiEmbedding, index, [
            [{ json: { error: String(error) } }],
          ]);
          throw error;
        }
      },
      embedDocuments: async (texts: string[]) => {
        const documents = validateDocuments(self, texts);
        const { index } = self.addInputData(NodeConnectionTypes.AiEmbedding, [
          [{ json: { documents } }],
        ]);
        try {
          const response: number[][] = [];
          for (let i = 0; i < documents.length; i += BATCH_SIZE) {
            response.push(...(await embedBatch(documents.slice(i, i + BATCH_SIZE))));
          }
          self.addOutputData(NodeConnectionTypes.AiEmbedding, index, [
            [{ json: { response } }],
          ]);
          return response;
        } catch (error) {
          self.addOutputData(NodeConnectionTypes.AiEmbedding, index, [
            [{ json: { error: String(error) } }],
          ]);
          throw error;
        }
      },
    };

    return { response: embedder };
  }
}
