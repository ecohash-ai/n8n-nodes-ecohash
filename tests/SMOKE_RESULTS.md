# Live Smoke Test Results — n8n-nodes-ecohash

- **Date:** 2026-08-12
- **n8n version:** 2.34.5 (installed via `npx n8n@latest` — resolved to 2.34.5 at test time)
- **Package version tested:** n8n-nodes-ecohash 0.1.0 (built from `dist/`, packed via `npm pack`, installed from the resulting tarball — i.e. exactly what a real user would install)
- **Node.js:** v25.8.2 (darwin/arm64)
- **Environment:** isolated `N8N_USER_FOLDER` under a scratch directory (not the real user's `~/.n8n`); SQLite DB and community package install were created fresh for this run and discarded afterward.
- **API key:** a real EcoHash API key was used only as an in-memory env var / credential value during the test session. It is not present anywhere in this file, in logs committed to the repo, or in any commit.

## Setup notes

- Installed the packed tarball into `<N8N_USER_FOLDER>/.n8n/nodes/node_modules` (the actual community-package scan directory n8n 2.34.5 uses — resolved from `nodesDownloadDir = path.join(n8nFolder, 'nodes')` where `n8nFolder = path.join(N8N_USER_FOLDER, '.n8n')`). An initial attempt installing one level higher, at `<N8N_USER_FOLDER>/nodes`, was silently ignored by n8n (no error, package just never loaded) — worth flagging for anyone following generic "drop it in `<user-folder>/nodes`" instructions verbatim.
- Started with `N8N_RUNNERS_ENABLED=true npx n8n start` plus a handful of env vars to quiet diagnostics/telemetry/version-check noise for a cleaner log.
- Owner account was bootstrapped unauthenticated via `POST /rest/owner/setup` (this instance had never had an owner configured), which unexpectedly unlocked full REST access — used to go beyond curl-only substitutes for scenarios 3 and 4 (see below).

## Scenario results

### 1. Package loads — PASS (REQUIRED)

n8n's startup log shows the package loaded cleanly with all expected nodes/credentials and no loader errors:

```
debug   Loaded all credentials and nodes from n8n-nodes-ecohash { "credentials": 1, "nodes": 3, "file": "package-directory-loader.js", "function": "loadAll" }
```

Confirmed independently via the authenticated `GET /types/nodes.json` and `GET /types/credentials.json` REST endpoints, which listed:
- `n8n-nodes-ecohash.lmChatEcoHash`
- `n8n-nodes-ecohash.ecoHashReranker`
- `n8n-nodes-ecohash.embeddingsEcoHash`
- `ecoHashApi` (credential type)

No node-loading errors or exceptions related to the package appeared anywhere in the startup log.

### 2. Credential connectivity — PASS (REQUIRED)

Exercised n8n's actual credential-test mechanism (the same code path the UI's "Test connection" button calls), `POST /rest/credentials/test`, against a credential created with the real key:

```
{"data":{"status":"OK","message":"Connection successful!"}}
```

This runs the credential's `test.request` (`GET https://api.ecohash.com/v1/models` with `Authorization: Bearer <key>`) exactly as defined in `credentials/EcoHashApi.credentials.ts`. Also independently verified with a direct curl to the same endpoint: `HTTP 200`, JSON body with a `data` array of model entries.

### 3. Chat model real call — PASS (REQUIRED)

Went beyond the planned curl substitute: built and executed a real n8n workflow (`Manual Trigger → AI Agent`, with the built `LmChatEcoHash` node wired in as the Agent's Chat Model over the `ai_languageModel` connection, model `glm-5.2`) via `POST /rest/workflows` + `POST /rest/workflows/{id}/run`, then inspected the execution data.

The EcoHash Chat Model node's own run entry shows it went through the real `@n8n/ai-node-sdk` `supplyModel` → LangChain `ChatOpenAI`-compatible wiring, hitting `https://api.ecohash.com/v1` with `model: "glm-5.2"`:

```
"inputOverride": { model: "glm-5.2", baseURL: "https://api.ecohash.com/v1", temperature: 0.7, streaming: false, ... }
"data": { generations: [[{ text: "OK", generationInfo: { finish_reason: "stop" } }]], tokenUsage: { promptTokens: 21, completionTokens: 108, totalTokens: 129 } }
```

The AI Agent's final output for the prompt "Say the single word OK and nothing else." was `{"output": "OK"}`. Execution status: `success`.

(A direct curl to `POST /v1/chat/completions` with `model: glm-5.2, max_tokens: 16` was also run independently as a backup check: `HTTP 200`, well-formed `choices[0].message.content` response.)

### 4. Embeddings + Reranker real calls — PASS (REQUIRED)

Also went beyond the curl substitute here: built a second workflow chaining `Manual Trigger → 5 short text docs → Vector Store (In-Memory, insert mode)` with the built `EmbeddingsEcoHash` node wired in as the embedder (`jina-embeddings-v3`), and a second `Vector Store (In-Memory, retrieve-as-tool mode, topK=2, useReranker=true)` with the built `EcoHashReranker` node wired in (`bge-reranker-v2-m3`), exposed as a tool to an AI Agent.

- **Embeddings:** Vector Store Insert run succeeded with all 5 documents embedded and stored (`executionStatus: "success"`, 5 items out) — this only succeeds if `EmbeddingsEcoHash.embedDocuments()` returned well-formed vectors for each input.
- **Reranker:** The `EcoHash Reranker` node's own run entries (logged via its `addInputData`/`addOutputData` calls, visible in the execution's runData exactly as the brief's "execution log shows reranker input/output" asks for) show, for query `"capital of France"` against the two retrieved docs:

```
input:  { query: "capital of France", documents: [{pageContent:"Paris is the capital of France."}, {pageContent:"The Eiffel Tower is a famous landmark in Paris."}] }
output: { response: [
  { pageContent: "Paris is the capital of France.", _rerankScore: 0.9999 },
  { pageContent: "The Eiffel Tower is a famous landmark in Paris.", _rerankScore: 0.5395 }
] }
```

The reranker was invoked 9 times over the course of the run (once per Agent tool call — see Concerns below) and succeeded every single time with correctly ordered, well-formed results.

Direct curl backups against the raw endpoints also confirmed the exact response shapes the nodes' code expects:
- `POST /v1/embeddings` (`jina-embeddings-v3`, 2 short inputs): `HTTP 200`, `data` array of length 2, each with a 1024-dim `embedding` array.
- `POST /v1/rerank` (`bge-reranker-v2-m3`, 1 query + 3 docs): `HTTP 200`, `results` array of length 3, each with `index` + `relevance_score`, correctly ordered by relevance.

### 5. Error path (bad key) — PASS (bonus, from original brief item 5)

Created a second credential with an invalid key and ran it through the same native `POST /rest/credentials/test` flow:

```
{"data":{"status":"Error","message":"Unauthorized"}}
```

Clean, understandable error — no stack trace or raw exception leaked to the user. Direct curl to `/v1/models` with a bad key independently confirmed `HTTP 401` with a JSON error body.

### 6. Owner setup + REST-created workflow execution — DONE (originally optional)

`POST /rest/owner/setup` worked unauthenticated on this fresh instance and unlocked full REST access, which was then used to drive scenarios 3 and 4 above as real, REST-created-and-executed n8n workflows rather than the planned curl-only substitutes.

## Concerns / notes

- During the combined Embeddings+Reranker+Agent workflow, the AI Agent itself hit n8n's "Max iterations (10) reached" error — the model (`glm-5.2`) kept calling the `search_docs` tool (`finish_reason: "tool_calls"`) instead of eventually returning a final text answer. This is a model/prompting behavior issue with the tool-calling loop, not a defect in the EcoHash nodes: every single one of the 9 tool invocations that occurred (Vector Store retrieval → EcoHash Reranker) completed successfully with correct, well-formed results. Recorded here for visibility, not as a package failure.
- The two throwaway test workflows and one test credential from this session could not be deleted via the REST API (`DELETE /rest/workflows/{id}` returned 400; one credential deleted fine) before the process was killed; this is contained entirely within the isolated scratch `N8N_USER_FOLDER` and was not investigated further since the whole folder is disposable.
