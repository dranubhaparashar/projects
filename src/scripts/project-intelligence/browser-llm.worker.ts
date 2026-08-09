/// <reference lib="webworker" />

import { env, pipeline } from "@huggingface/transformers";
import type { BrowserAiProgress } from "./browser-ai-types";

declare const self: DedicatedWorkerGlobalScope;

const LLM_MODEL = "onnx-community/Qwen2.5-0.5B-Instruct";

env.allowLocalModels = false;
env.useBrowserCache = true;

type WorkerRequest =
	| { id: number; type: "initialize" }
	| {
			id: number;
			type: "generate";
			messages: Array<{
				role: "system" | "user" | "assistant";
				content: string;
			}>;
	  };

let generationPipelinePromise: ReturnType<
	typeof createGenerationPipeline
> | null = null;

function developmentLog(event: string, detail?: unknown): void {
	if (!import.meta.env.DEV) return;
	if (detail === undefined) {
		console.info(`[Project Intelligence local AI worker] ${event}`);
		return;
	}
	console.info(`[Project Intelligence local AI worker] ${event}`, detail);
}

function postProgress(id: number, value: unknown): void {
	const detail = value && typeof value === "object" ? value : {};
	const record = detail as Record<string, unknown>;
	self.postMessage({
		id,
		type: "progress",
		progress: {
			stage: "llm-model",
			status: String(record.status || "loading"),
			progress:
				typeof record.progress === "number" ? record.progress : undefined,
			loaded: typeof record.loaded === "number" ? record.loaded : undefined,
			total: typeof record.total === "number" ? record.total : undefined,
			name: typeof record.name === "string" ? record.name : undefined,
			file: typeof record.file === "string" ? record.file : undefined,
		} satisfies BrowserAiProgress,
	});
}

async function createGenerationPipeline(id: number) {
	developmentLog("model ID", LLM_MODEL);
	postProgress(id, { status: "initializing-webgpu" });
	const generator = await pipeline("text-generation", LLM_MODEL, {
		device: "webgpu",
		dtype: "q4",
		progress_callback: (value) => {
			developmentLog("progress event", value);
			postProgress(id, value);
		},
	});
	developmentLog("download complete", {
		modelId: LLM_MODEL,
		browserCacheEnabled: env.useBrowserCache,
	});
	developmentLog("model initialization complete", { modelId: LLM_MODEL });
	return generator;
}

function getGenerationPipeline(id: number) {
	if (!generationPipelinePromise) {
		generationPipelinePromise = createGenerationPipeline(id).catch((error) => {
			generationPipelinePromise = null;
			throw error;
		});
	}
	return generationPipelinePromise;
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
		if (request.type === "initialize") {
			await getGenerationPipeline(request.id);
			self.postMessage({ id: request.id, type: "result", result: "ready" });
			return;
		}

		if (!generationPipelinePromise) {
			throw new Error("Local AI model has not been initialized");
		}
		const generator = await generationPipelinePromise;
		developmentLog("generation start", { modelId: LLM_MODEL });
		self.postMessage({
			id: request.id,
			type: "progress",
			progress: {
				stage: "generation",
				status: "running",
			} satisfies BrowserAiProgress,
		});
		const result = await generator(request.messages, {
			max_new_tokens: 240,
			do_sample: false,
			repetition_penalty: 1.05,
			return_full_text: false,
		});
		developmentLog("generation complete", { modelId: LLM_MODEL });
		self.postMessage({
			id: request.id,
			type: "result",
			result: generatedText(result),
		});
	} catch (error) {
		developmentLog("worker error", {
			requestType: request.type,
			modelId: LLM_MODEL,
			error: error instanceof Error ? error.message : String(error),
		});
		self.postMessage({
			id: request.id,
			type: "error",
			error: error instanceof Error ? error.message : "Local AI worker failed",
		});
	}
});
