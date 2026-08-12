import { supplyModel } from '@n8n/ai-node-sdk';
import {
  NodeConnectionTypes,
  type ILoadOptionsFunctions,
  type INodePropertyOptions,
  type INodeType,
  type INodeTypeDescription,
  type ISupplyDataFunctions,
  type SupplyData,
} from 'n8n-workflow';
import { ECOHASH_BASE_URL, loadModelOptions } from '../shared/ecohashApi';

export class LmChatEcoHash implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'EcoHash Chat Model',
    name: 'lmChatEcoHash',
    icon: 'file:ecohash.svg',
    group: ['transform'],
    version: 1,
    description: 'Use EcoHash chat and vision models with AI Agents and Chains',
    defaults: { name: 'EcoHash Chat Model' },
    codex: {
      categories: ['AI'],
      subcategories: { AI: ['Language Models'] },
      resources: {
        primaryDocumentation: [{ url: 'https://docs.ecohash.com/platform-models/chat-completions' }],
      },
    },
    inputs: [],
    outputs: [NodeConnectionTypes.AiLanguageModel],
    outputNames: ['Model'],
    credentials: [{ name: 'ecoHashApi', required: true }],
    properties: [
      {
        displayName: 'Model',
        name: 'model',
        type: 'options',
        typeOptions: { loadOptionsMethod: 'getModels' },
        default: 'GLM-5.2',
        description: 'Chat or vision model from the EcoHash catalog',
      },
      {
        displayName: 'Temperature',
        name: 'temperature',
        type: 'number',
        typeOptions: { minValue: 0, maxValue: 2, numberPrecision: 2 },
        default: 0.7,
      },
    ],
  };

  methods = {
    loadOptions: {
      async getModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const options = await loadModelOptions(this, ['llm', 'llm_vision']);
        return options.length ? options : [{ name: 'GLM-5.2', value: 'GLM-5.2' }];
      },
    },
  };

  async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
    const credentials = (await this.getCredentials('ecoHashApi')) as { apiKey: string };
    const model = this.getNodeParameter('model', itemIndex) as string;
    const temperature = this.getNodeParameter('temperature', itemIndex) as number;
    // n8n-workflow major-version skew: this package types against 1.x, @n8n/ai-utilities' nested copy is 2.x
    return await supplyModel(this as unknown as Parameters<typeof supplyModel>[0], {
      type: 'openai',
      baseUrl: ECOHASH_BASE_URL,
      apiKey: credentials.apiKey,
      model,
      temperature,
    });
  }
}
