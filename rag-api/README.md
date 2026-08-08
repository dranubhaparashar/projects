# Project Intelligence hybrid RAG API

This directory keeps the optional high-power, self-hosted Project Intelligence service. The public GitHub Pages assistant does not require it: its default zero-cost mode performs BGE query embedding, vector search, hybrid ranking, and optional small-Qwen generation in the visitor's browser.

## Public zero-cost architecture

```text
Published src/content/posts Markdown/front matter
        |
        | build-time Python index/export
        v
Static chunks + normalized Float32 BGE vectors
        |
        v
GitHub Pages /projects/
        |
        +-- existing lexical retrieval
        +-- Xenova/bge-small-en-v1.5 query embedding (browser WASM)
        +-- direct normalized dot-product search + hybrid ranking
        `-- Qwen2.5-0.5B-Instruct q4f16 (browser WebGPU, when capable)
                |
                v
        Grounded answer + TypeScript-mapped trusted sources
```

The default requires no API key, paid API, Python runtime, server adapter, vector database, or external inference service. Open model files are fetched from Hugging Face on first use and cached through the inference runtime; the question itself is not sent to a hosted inference API. The normal portfolio page dynamically imports Project Intelligence and does not initialize either model on page load.

Browser embedding details:

- runtime: `@huggingface/transformers` 3.8.1
- model: `Xenova/bge-small-en-v1.5`, the ONNX conversion of `BAAI/bge-small-en-v1.5`
- pooling: CLS, matching the SentenceTransformers model's `1_Pooling/config.json`
- normalized 384-dimensional vectors
- static vectors: raw little-endian Float32 rows in `public/project-intelligence/project-vectors.bin`

Optional browser generation details:

- runtime: `@huggingface/transformers` 3.8.1
- model: `onnx-community/Qwen2.5-0.5B-Instruct`
- quantization: `q4f16`
- license: Apache-2.0
- approximate model file download: 483 MB
- enabled only on non-mobile, non-low-memory devices with WebGPU and `shader-f16`

If WebGPU is missing or generation fails, browser hybrid retrieval still returns a sourced deterministic answer. If browser embedding also fails, the original quick lexical Project Intelligence answer remains available.

## Optional high-power architecture

```text
Astro on GitHub Pages
        |
        | HTTPS POST /ask
        v
FastAPI Project Intelligence service
        |
        v
Hybrid retriever
  |-- existing browser lexical ranking (validated hints)
  |-- server metadata lexical fallback
  `-- BAAI/bge-small-en-v1.5 + normalized FAISS IndexFlatIP
        |
        v
Top section-aware project chunks
        |
        v
Qwen3-4B through Ollama
        |
        v
Grounded answer + backend-mapped project sources
```

Execution precedence is:

1. `PUBLIC_PROJECT_AI_API_URL` configured: try this self-hosted FastAPI mode.
2. Otherwise, or if that request fails: browser-local BGE RAG.
3. If browser RAG is unsupported or errors: quick deterministic lexical search.

An unset `PUBLIC_PROJECT_AI_API_URL` is the expected GitHub Pages production configuration, not an error. GitHub Pages cannot run Python, FastAPI, FAISS, or Ollama.

## Local setup

Install [Ollama](https://ollama.com/) and pull the open Qwen3 model:

```powershell
ollama pull qwen3:4b
```

Windows PowerShell:

```powershell
cd rag-api
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python scripts\build_index.py
uvicorn app.main:app --reload --port 8000
```

Linux, macOS, or WSL:

```bash
cd rag-api
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python scripts/build_index.py
uvicorn app.main:app --reload --port 8000
```

In another terminal, configure and run Astro:

```powershell
$env:PUBLIC_PROJECT_AI_API_URL="http://localhost:8000"
$env:PUBLIC_PROJECT_AI_TIMEOUT_MS="25000"
pnpm dev
```

Only for the optional high-power mode, set the externally reachable RAG service URL before `pnpm build`:

```powershell
$env:PUBLIC_PROJECT_AI_API_URL="https://YOUR-RAG-SERVICE.example.com"
pnpm build
```

Do not set this variable to localhost for the GitHub Pages build. Leave it unset for the public zero-cost mode.

## Rebuild the knowledge index

Astro Markdown/front matter under `src/content/posts/` is the only portfolio source of truth. After adding or changing a project, rebuild:

```powershell
cd rag-api
python scripts\build_index.py
```

The command regenerates both backend and browser assets:

- `data/project_chunks.json`: published project metadata and section-aware chunks
- `data/project_vectors.faiss`: normalized BGE vectors in `faiss.IndexFlatIP`
- `data/project_vectors_meta.json`: deterministic FAISS positions, dimensions, counts, content hash, and generation metadata
- `../public/project-intelligence/project-chunks.json`: published browser-safe chunks and project metadata
- `../public/project-intelligence/project-vector-metadata.json`: model, vector format, canonical chunk IDs, and trusted URLs
- `../public/project-intelligence/project-vectors.bin`: normalized Float32 vectors in canonical chunk order

To re-export browser assets from an unchanged persisted FAISS index without loading BGE again, run from the repository root:

```powershell
pnpm rag:export-browser
```

`pnpm build` validates counts, dimensions, hashes, ordering, trusted `/projects/posts/` URLs, and the exact binary byte size. The repository keeps these small static index assets committed, avoiding a Hugging Face model download on every frontend-only GitHub Actions run.

Draft/private/admin/unpublished/future posts are excluded. Long Markdown sections are split at a maximum of 620 words with a modest overlap; short semantic sections remain intact. Startup refuses inconsistent vector/metadata counts or dimensions.

## API

`GET /health` reports only component readiness. It never returns model-server URLs, environment values, paths, or stack traces.

`POST /ask` accepts a validated question, up to six short session turns, an optional current project ID, and optional lexical matches produced by the existing browser engine. It returns a grounded answer plus trusted source links mapped from retrieved metadata.

`POST /retrieve` exists only when `PROJECT_AI_DEBUG_RETRIEVAL=true`. Never enable it on a public deployment unless retrieval diagnostics are intentionally required.

## Retrieval and grounding

- Semantic top K defaults to 12.
- Hybrid ranking defaults to `0.65 * normalized semantic + 0.35 * normalized lexical`.
- Exact project names and specialist technology/capability terms receive a deterministic boost.
- Broad queries are diversified across projects; comparison queries reserve context for both named projects.
- Up to eight context chunks and five projects are selected.
- Retrieved Markdown is XML-delimited as untrusted evidence in the user message, never concatenated into the system prompt.
- Qwen3 may return source IDs only. The backend maps those IDs to known URLs, so the model cannot invent project links.
- Documented deployment status is passed explicitly; production claims are not inferred from phrases such as “production-ready.”

## Providers

Ollama is the default:

```dotenv
PROJECT_AI_LLM_PROVIDER=ollama
PROJECT_AI_LLM_MODEL=qwen3:4b
PROJECT_AI_OLLAMA_URL=http://localhost:11434
```

For a self-hosted vLLM or llama.cpp server using the common OpenAI-compatible protocol:

```dotenv
PROJECT_AI_LLM_PROVIDER=openai-compatible
PROJECT_AI_LLM_BASE_URL=http://your-self-hosted-server:8080
PROJECT_AI_LLM_MODEL=your-open-model
```

This project does not call OpenAI, Gemini, Anthropic, or proprietary embedding APIs.

## Tests and evaluation

Unit/API tests use an in-memory deterministic embedding/index and do not require Ollama:

```powershell
pytest -q
```

Evaluate the persisted BGE/FAISS index against the representative 24-question set:

```powershell
python scripts\evaluate.py
```

The evaluation checks retrieval recall, not exact generated prose. During local end-to-end validation, start Ollama and FastAPI, check `/health`, call `/ask`, then stop FastAPI and confirm the Astro assistant labels and uses its quick deterministic portfolio search.

## Docker

Build the index first, then build the API image:

```powershell
python scripts\build_index.py
docker build -t project-intelligence-rag .
docker run --rm -p 8000:8000 --env-file .env project-intelligence-rag
```

The image includes FastAPI, embedding support, retrieval code, and the generated FAISS index. It intentionally does not bake the multi-gigabyte Qwen model into the image. Run Ollama as a separate service and set `PROJECT_AI_OLLAMA_URL` to an address reachable from the container.

## Optional self-hosted deployment checklist

1. Deploy `rag-api/` to a container/VM service with persistent model cache and enough RAM for BGE plus Qwen inference.
2. Keep Ollama or another self-hosted open-model server private to the API network.
3. Set `PROJECT_AI_ALLOWED_ORIGINS=https://dranubhaparashar.github.io`.
4. Put HTTPS and platform-level request limits in front of FastAPI.
5. Build Astro with `PUBLIC_PROJECT_AI_API_URL` set to that public HTTPS endpoint.
6. Verify `/health`, `/ask`, CORS, timeout fallback, and backend-offline fallback from the deployed site.
