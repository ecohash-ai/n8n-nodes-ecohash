# n8n-nodes-ecohash

[![npm version](https://img.shields.io/npm/v/n8n-nodes-ecohash)](https://www.npmjs.com/package/n8n-nodes-ecohash)

This is an n8n community node package for [EcoHash](https://docs.ecohash.com), an OpenAI-compatible model API platform. It adds a Chat Model, a Reranker, and an Embeddings sub-node so you can use EcoHash-hosted models inside n8n's LangChain-based AI nodes (AI Agent, Vector Store retrieval, Question and Answer Chain, etc.).

[n8n](https://n8n.io) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

## What is EcoHash

EcoHash ([docs.ecohash.com](https://docs.ecohash.com)) is an OpenAI-compatible API for chat, vision, embedding, and reranking models. Sign up at [ecohash.com](https://ecohash.com) — new accounts include free starter credit, so you can try the nodes below without adding a payment method first.

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

All three nodes share a single credential type: **EcoHash API**. You only need one API key (it starts with `eco_`).

1. Create an account at [ecohash.com](https://ecohash.com) if you haven't already.
2. Generate an API key by following [docs.ecohash.com/getting-started/api-keys](https://docs.ecohash.com/getting-started/api-keys).
3. In n8n, create a new **EcoHash API** credential and paste the key in.

Saving the credential runs a connectivity check against EcoHash's models endpoint, so you'll get immediate feedback if the key is invalid.

## Nodes

### EcoHash Chat Model

A Language Model sub-node that plugs into the **Model** input of AI Agent, Basic LLM Chain, and other LangChain-based nodes in n8n. It gives you access to the EcoHash chat and vision catalog — including GLM, Llama, Qwen, and Gemma families — with an adjustable temperature. The model list is loaded live from EcoHash's catalog, so it stays current as new models are added.

Typical workflow: **Chat Trigger → AI Agent** (with **EcoHash Chat Model** attached to the Agent's Model input) **→ respond to chat**.

### EcoHash Reranker

A Reranker sub-node that plugs into the **Reranker** input of a Vector Store retrieval node or a Question and Answer Chain. It uses EcoHash's BGE reranker models (`bge-reranker-v2-m3` by default) to re-score retrieved documents against the query and return the top-K matches. n8n's built-in reranker only supports Cohere; this node fills that gap for anyone who wants a self-hostable, OpenAI-compatible alternative.

Typical workflow: Vector Store (retrieve) with **EcoHash Reranker** attached to its Reranker input → AI Agent / Question and Answer Chain.

### Embeddings EcoHash

An Embeddings sub-node that plugs into the **Embeddings** input of any Vector Store node (insert or retrieve mode). It supports EcoHash's embedding models, including the `jina-embeddings-v3` / `v4` and `qwen3-embedding` families, and automatically batches large document sets before sending them to the API.

Typical workflow: **Data source → Default Data Loader → Text Splitter → Vector Store (insert)** (with **Embeddings EcoHash** attached to the Vector Store's Embeddings input).

## Example: RAG with reranking

A minimal retrieval-augmented generation workflow using all three nodes:

1. **Insert phase** — load your documents (e.g. from a file or database), split them with a Text Splitter, and insert them into a Vector Store using **Embeddings EcoHash** for the embedding step.
2. **Chat Trigger** starts the workflow when a user sends a message.
3. **AI Agent** receives the message. Attach an **EcoHash Chat Model** node to the Agent's Model input so it can reason and generate the final answer.
4. Give the Agent a **Vector Store (retrieve)** tool pointed at the index you created in step 1.
5. Attach an **EcoHash Reranker** node to the Vector Store tool's Reranker input, with **Top K** set to a small number (e.g. 2-3). This re-scores the retrieved chunks against the user's query so the Agent only sees the most relevant ones.
6. The Agent responds using the reranked context.

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
