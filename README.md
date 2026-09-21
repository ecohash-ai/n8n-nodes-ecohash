# n8n-nodes-ecohash

[![npm version](https://img.shields.io/npm/v/n8n-nodes-ecohash)](https://www.npmjs.com/package/n8n-nodes-ecohash)

This is an n8n community node package for [EcoHash](https://docs.ecohash.com), an OpenAI-compatible model API platform. It adds an **EcoHash Chat Model** sub-node so you can use EcoHash-hosted chat and vision models inside n8n's AI nodes (AI Agent, Basic LLM Chain, Question and Answer Chain, etc.).

The node is built on n8n's public [`@n8n/ai-node-sdk`](https://github.com/n8n-io/n8n/tree/master/packages/%40n8n/ai-node-sdk), and every model request it makes is sent to the EcoHash API at `https://api.ecohash.com/v1`.

[n8n](https://n8n.io) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

## What is EcoHash

EcoHash ([docs.ecohash.com](https://docs.ecohash.com)) is an OpenAI-compatible API for chat, vision, embedding, and reranking models. Sign up at [ecohash.com](https://ecohash.com) — new accounts include free starter credit, so you can try the node below without adding a payment method first.

## Installation

### n8n Cloud

n8n Cloud has supported self-service installation of verified community nodes since n8n version 1.94.0. Once this package passes n8n's community node verification review, you'll be able to go to **Nodes** in your instance and search for "EcoHash" to install it directly. Until then, use the self-hosted method below.

### Self-hosted

Follow the n8n [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/). In short:

1. Go to **Settings > Community Nodes**.
2. Select **Install**.
3. Enter `n8n-nodes-ecohash` in **npm Package Name**.
4. Agree to the risks of using community nodes and select **Install**.

You can also install it with the n8n CLI or as part of a custom Docker image — see the [community nodes documentation](https://docs.n8n.io/integrations/community-nodes/installation/) for those methods.

## Credentials

The node uses a single credential type: **EcoHash API**. You only need one API key (it starts with `eco_`).

1. Create an account at [ecohash.com](https://ecohash.com) if you haven't already.
2. Generate an API key by following [docs.ecohash.com/getting-started/api-keys](https://docs.ecohash.com/getting-started/api-keys).
3. In n8n, create a new **EcoHash API** credential and paste the key in.

Saving the credential runs a connectivity check against EcoHash's models endpoint, so you'll get immediate feedback if the key is invalid.

## Nodes

### EcoHash Chat Model

A Language Model sub-node that plugs into the **Model** input of AI Agent, Basic LLM Chain, and other AI nodes in n8n. It gives you access to the EcoHash chat and vision catalog — including GLM, Llama, Qwen, and Gemma families — with an adjustable temperature. The model list is loaded live from EcoHash's catalog, so it stays current as new models are added.

All chat completions are sent to `https://api.ecohash.com/v1` using your EcoHash API key. No other endpoint is contacted.

Typical workflow: **Chat Trigger → AI Agent** (with **EcoHash Chat Model** attached to the Agent's Model input) **→ respond to chat**.

## Example workflow

[`examples/chat-agent-demo.json`](examples/chat-agent-demo.json) is a minimal, importable workflow: a Chat Trigger feeds an AI Agent, and the **EcoHash Chat Model** node supplies the model.

1. In n8n, open a new workflow and choose **Import from File**, then pick the JSON file.
2. Select your **EcoHash API** credential on the **EcoHash Chat Model** node.
3. Click **Open chat** and send a message. The Agent replies using the selected EcoHash model.

## Compatibility

Developed and tested against n8n 2.x (2.34+). n8n Cloud has supported installing verified community nodes since version 1.94.0.

## Resources

- [EcoHash documentation](https://docs.ecohash.com)
- [EcoHash sign-up and pricing](https://ecohash.com)
- [EcoHash API keys guide](https://docs.ecohash.com/getting-started/api-keys)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- Support: contact EcoHash through [docs.ecohash.com](https://docs.ecohash.com)

## License

[MIT](LICENSE)
