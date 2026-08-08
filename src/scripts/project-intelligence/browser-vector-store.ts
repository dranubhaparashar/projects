import type { BrowserAssetUrls, BrowserProjectChunk } from "./browser-ai-types";

interface BrowserProjectMetadata {
	id: string;
	title: string;
	url: string;
	related_project_ids: string[];
}

interface BrowserChunkPayload {
	index: {
		content_hash: string;
		project_count: number;
		chunk_count: number;
	};
	projects: BrowserProjectMetadata[];
	chunks: BrowserProjectChunk[];
}

interface BrowserVectorMetadata {
	version: number;
	model: string;
	browser_model: string;
	dimensions: number;
	count: number;
	dtype: string;
	pooling: string;
	normalized: boolean;
	query_instruction: string;
	content_hash: string;
	chunks: Array<{
		index: number;
		chunk_id: string;
		project_id: string;
		project_title: string;
		section: string;
		url: string;
	}>;
}

export interface BrowserVectorStore {
	chunks: BrowserProjectChunk[];
	projects: BrowserProjectMetadata[];
	metadata: BrowserVectorMetadata;
	vectors: Float32Array;
}

export interface SemanticHit {
	index: number;
	score: number;
}

const stores = new Map<string, Promise<BrowserVectorStore>>();

function trustedProjectUrl(value: string): boolean {
	return /^\/projects\/posts\/[a-z0-9%/_-]+\/?$/i.test(value);
}

async function fetchOk(url: string): Promise<Response> {
	const response = await fetch(url, { credentials: "same-origin" });
	if (!response.ok)
		throw new Error(`Static Project Intelligence asset failed: ${url}`);
	return response;
}

export function loadBrowserVectorStore(
	urls: BrowserAssetUrls,
): Promise<BrowserVectorStore> {
	const key = `${urls.chunks}|${urls.vectorMetadata}|${urls.vectors}`;
	const existing = stores.get(key);
	if (existing) return existing;
	const promise = Promise.all([
		fetchOk(urls.chunks).then(
			(response) => response.json() as Promise<BrowserChunkPayload>,
		),
		fetchOk(urls.vectorMetadata).then(
			(response) => response.json() as Promise<BrowserVectorMetadata>,
		),
		fetchOk(urls.vectors).then((response) => response.arrayBuffer()),
	]).then(([payload, metadata, buffer]) => {
		if (
			metadata.model !== "BAAI/bge-small-en-v1.5" ||
			metadata.browser_model !== "Xenova/bge-small-en-v1.5" ||
			metadata.dimensions !== 384 ||
			metadata.dtype !== "float32-le" ||
			metadata.pooling !== "cls" ||
			!metadata.normalized
		) {
			throw new Error(
				"Static vector metadata is incompatible with browser BGE",
			);
		}
		if (
			payload.chunks.length !== metadata.count ||
			metadata.chunks.length !== metadata.count ||
			buffer.byteLength !== metadata.count * metadata.dimensions * 4 ||
			payload.index.content_hash !== metadata.content_hash
		) {
			throw new Error("Static Project Intelligence assets are inconsistent");
		}
		for (let index = 0; index < metadata.count; index += 1) {
			const chunk = payload.chunks[index];
			const position = metadata.chunks[index];
			if (
				position.index !== index ||
				position.chunk_id !== chunk.chunk_id ||
				!trustedProjectUrl(chunk.url) ||
				!trustedProjectUrl(position.url)
			) {
				throw new Error(`Untrusted or mismatched vector row ${index}`);
			}
		}
		return {
			chunks: payload.chunks,
			projects: payload.projects.filter((project) =>
				trustedProjectUrl(project.url),
			),
			metadata,
			vectors: new Float32Array(buffer),
		};
	});
	stores.set(key, promise);
	promise.catch(() => stores.delete(key));
	return promise;
}

export function searchNormalizedVectors(
	store: BrowserVectorStore,
	query: Float32Array,
	topK = 12,
): SemanticHit[] {
	const dimensions = store.metadata.dimensions;
	if (query.length !== dimensions)
		throw new Error("Query vector dimension mismatch");
	const best: SemanticHit[] = [];
	for (let row = 0; row < store.metadata.count; row += 1) {
		const offset = row * dimensions;
		let score = 0;
		for (let column = 0; column < dimensions; column += 1) {
			score += query[column] * store.vectors[offset + column];
		}
		if (best.length < topK || score > best[best.length - 1].score) {
			let position = best.length;
			while (position > 0 && best[position - 1].score < score) position -= 1;
			best.splice(position, 0, { index: row, score });
			if (best.length > topK) best.pop();
		}
	}
	return best;
}
