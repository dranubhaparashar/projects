import { embedInBrowser } from "./browser-ai-client";
import type { BrowserAiProgress } from "./browser-ai-types";

export const BROWSER_EMBEDDING_MODEL = "Xenova/bge-small-en-v1.5";
export const BGE_QUERY_INSTRUCTION =
	"Represent this sentence for searching relevant passages: ";
export const BGE_DIMENSIONS = 384;

export async function embedBrowserQuery(
	question: string,
	onProgress?: (progress: BrowserAiProgress) => void,
	signal?: AbortSignal,
): Promise<Float32Array> {
	const vector = await embedInBrowser(
		`${BGE_QUERY_INSTRUCTION}${question.trim()}`,
		onProgress,
		signal,
	);
	if (vector.length !== BGE_DIMENSIONS) {
		throw new Error(`Expected ${BGE_DIMENSIONS} embedding dimensions`);
	}
	let normSquared = 0;
	for (const value of vector) normSquared += value * value;
	if (Math.abs(Math.sqrt(normSquared) - 1) > 0.01) {
		throw new Error("Browser query embedding is not normalized");
	}
	return vector;
}
