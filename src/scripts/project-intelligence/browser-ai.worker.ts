/// <reference lib="webworker" />

import { env, pipeline } from "@huggingface/transformers";
import type { BrowserAiProgress } from "./browser-ai-types";

declare const self: DedicatedWorkerGlobalScope;

const EMBEDDING_MODEL = "Xenova/bge-small-en-v1.5";
const LLM_MODEL = "onnx-community/Qwen2.5-0.5B-Instruct";

env.allowLocalModels = false;
env.useBrowserCache = true;

type WorkerRequest =
	| { id: number; type: "embed"; text: string }
	| {
			id: number;
			type: "generate";
			messages: Array<{
				role: "system" | "user" | "assistant";
				content: string;
			}>;
	  };

let embeddingPipelinePromise: ReturnType<
	typeof createEmbeddingPipeline
> | null = null;
let generationPipelinePromise: ReturnType<
	typeof createGenerationPipeline
> | null = null;

function postProgress(
	id: number,
	stage: BrowserAiProgress["stage"],
	value: unknown,
): void {
	const detail = value && typeof value === "object" ? value : {};
	const record = detail as Record<string, unknown>;
	self.postMessage({
		id,
		type: "progress",
		progress: {
			stage,
			status: String(record.status || "loading"),
			progress:
				typeof record.progress === "number" ? record.progress : undefined,
			loaded: typeof record.loaded === "number" ? record.loaded : undefined,
			total: typeof record.total === "number" ? record.total : undefined,
		} satisfies BrowserAiProgress,
	});
}

async function createEmbeddingPipeline(id: number) {
	return pipeline("feature-extraction", EMBEDDING_MODEL, {
		device: "wasm",
		dtype: "fp32",
		progress_callback: (value) => postProgress(id, "embedding-model", value),
	});
}

async function createGenerationPipeline(id: number) {
	return pipeline("text-generation", LLM_MODEL, {
		device: "webgpu",
		dtype: "q4f16",
		progress_callback: (value) => postProgress(id, "llm-model", value),
	});
}

function generatedText(value: unknown): string {
	if (!Array.isArray(value) || !value.length) return "";
	const candidate = value[0] as { generated_text?: unknown };
	if (typeof candidate.generated_text === "string") {
		return candidate.generated_text.trim();
	}
	if (Array.isArray(candidate.generated_text)) {
		const messages = candidate.generated_text as Array<{ content?: unknown }>;
		const last = messages.at(-1);
		return typeof last?.content === "string" ? last.content.trim() : "";
	}
	return "";
}

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
	const request = event.data;
	try {
		if (request.type === "embed") {
			embeddingPipelinePromise ||= createEmbeddingPipeline(request.id);
			const extractor = await embeddingPipelinePromise;
			postProgress(request.id, "embedding", { status: "running" });
			const output = await extractor(request.text, {
				pooling: "cls",
				normalize: true,
			});
			const vector = Float32Array.from(output.data as Float32Array);
			self.postMessage(
				{ id: request.id, type: "result", result: vector.buffer },
				[vector.buffer],
			);
			return;
		}

		generationPipelinePromise ||= createGenerationPipeline(request.id);
		const generator = await generationPipelinePromise;
		postProgress(request.id, "generation", { status: "running" });
		const result = await generator(request.messages, {
			max_new_tokens: 240,
			do_sample: false,
			repetition_penalty: 1.05,
			return_full_text: false,
		});
		self.postMessage({
			id: request.id,
			type: "result",
			result: generatedText(result),
		});
	} catch (error) {
		self.postMessage({
			id: request.id,
			type: "error",
			error:
				error instanceof Error ? error.message : "Browser inference failed",
		});
	}
});
