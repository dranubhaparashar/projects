/// <reference lib="webworker" />

import { env, pipeline } from "@huggingface/transformers";
import type { BrowserAiProgress } from "./browser-ai-types";
import {
	createLocalAiFailureDiagnostic,
	hasDeviceLostSignature,
	LOCAL_AI_DTYPE,
	LOCAL_AI_MODEL_ID,
	type LocalAiDiagnosticStage,
	logLocalAiFailure,
} from "./browser-llm-diagnostics";

declare const self: DedicatedWorkerGlobalScope;

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
const requestStages = new Map<number, LocalAiDiagnosticStage>();
interface DownloadFileProgress {
	file: string;
	loaded: number;
	total: number;
	totalKnown: boolean;
}

const activeDownloads = new Set<string>();
const downloadProgressByFile = new Map<string, DownloadFileProgress>();
let modelArtifactDownloaded = false;
let modelInitStagePosted = false;

function developmentLog(event: string, detail?: unknown): void {
	if (!import.meta.env.DEV) return;
	if (detail === undefined) {
		console.info(`[Project Intelligence local AI worker] ${event}`);
		return;
	}
	console.info(`[Project Intelligence local AI worker] ${event}`, detail);
}

function postProgress(id: number, progress: BrowserAiProgress): void {
	self.postMessage({
		id,
		type: "progress",
		progress,
	});
}

function downloadKey(record: Record<string, unknown>): string {
	return `${String(record.name || LOCAL_AI_MODEL_ID)}::${String(record.file || "unknown")}`;
}

function isModelArtifact(file: string): boolean {
	return /\.onnx(?:_data(?:_\d+)?)?$/i.test(file);
}

function updateDownloadProgress(record: Record<string, unknown>): void {
	if (
		typeof record.loaded !== "number" ||
		!Number.isFinite(record.loaded) ||
		record.loaded < 0
	) {
		return;
	}
	const key = downloadKey(record);
	const previous = downloadProgressByFile.get(key);
	const rawTotal =
		typeof record.total === "number" && Number.isFinite(record.total)
			? record.total
			: 0;
	const rawProgress =
		typeof record.progress === "number" && Number.isFinite(record.progress)
			? record.progress
			: 0;
	// Transformers.js reports total=loaded and progress=100 for every chunk when
	// Content-Length is absent. Only expose a total after the stream proves that
	// it is stable/known, otherwise the UI must remain byte-only.
	const totalKnown = Boolean(
		previous?.totalKnown ||
			rawTotal > record.loaded ||
			rawProgress < 100 ||
			(previous &&
				previous.total === rawTotal &&
				previous.loaded !== record.loaded),
	);
	downloadProgressByFile.set(key, {
		file: String(record.file || ""),
		loaded: record.loaded,
		total: rawTotal,
		totalKnown,
	});
}

function primaryDownloadProgress(): DownloadFileProgress | undefined {
	const values = [...downloadProgressByFile.values()];
	return values.sort((left, right) => {
		const artifactDifference =
			Number(isModelArtifact(right.file)) - Number(isModelArtifact(left.file));
		return artifactDifference || right.loaded - left.loaded;
	})[0];
}

function postDownloadProgress(
	id: number,
	record: Record<string, unknown>,
): void {
	const current = primaryDownloadProgress();
	postProgress(id, {
		stage: "llm-model",
		status: String(record.status || "loading"),
		progress:
			current?.totalKnown && current.total > 0
				? (current.loaded / current.total) * 100
				: undefined,
		loaded: current?.loaded,
		total: current?.totalKnown ? current.total : undefined,
		totalKnown: current?.totalKnown ?? false,
		name: typeof record.name === "string" ? record.name : undefined,
		file:
			current?.file ||
			(typeof record.file === "string" ? record.file : undefined),
	});
}

function postModelInitStage(id: number): void {
	if (modelInitStagePosted) return;
	modelInitStagePosted = true;
	requestStages.set(id, "model-init");
	developmentLog("download complete", {
		modelId: LOCAL_AI_MODEL_ID,
		browserCacheEnabled: env.useBrowserCache,
	});
	postProgress(id, {
		stage: "model-init",
		status: "initializing-webgpu",
	});
}

function scheduleModelInitStage(id: number): void {
	queueMicrotask(() => {
		if (modelArtifactDownloaded && activeDownloads.size === 0) {
			postModelInitStage(id);
		}
	});
}

function handlePipelineProgress(id: number, value: unknown): void {
	if (!value || typeof value !== "object") return;
	const record = value as Record<string, unknown>;
	const status = String(record.status || "");
	const key = downloadKey(record);
	if (/^(?:initiate|download|progress)$/i.test(status)) {
		requestStages.set(id, "download");
	}
	// Optional files can emit "initiate" and then resolve as absent without a
	// matching "done" event. Count only requests that actually start reading.
	if (/^(?:download|progress)$/i.test(status)) {
		activeDownloads.add(key);
	}
	if (status === "progress") updateDownloadProgress(record);
	if (status !== "ready") postDownloadProgress(id, record);
	if (status === "done") {
		activeDownloads.delete(key);
		if (isModelArtifact(String(record.file || ""))) {
			modelArtifactDownloaded = true;
		}
		scheduleModelInitStage(id);
	} else if (status === "ready") {
		postModelInitStage(id);
	}
}

function classifyFailureStage(
	error: unknown,
	fallback: LocalAiDiagnosticStage,
): LocalAiDiagnosticStage {
	const diagnostic = createLocalAiFailureDiagnostic(
		fallback,
		"stage-classification",
		error,
	);
	if (
		hasDeviceLostSignature(diagnostic) ||
		/webgpu|GPUAdapter|requestAdapter|no available adapters|WGSL|shader/i.test(
			`${diagnostic.errorName} ${diagnostic.errorMessage}`,
		)
	) {
		return "webgpu-init";
	}
	if (
		fallback !== "generation" &&
		/fetch|network|download|cache|content-length|response|HTTP\s*\d{3}/i.test(
			diagnostic.errorMessage,
		)
	) {
		return "download";
	}
	return fallback;
}

async function createGenerationPipeline(id: number) {
	requestStages.set(id, "download");
	developmentLog("model ID", LOCAL_AI_MODEL_ID);
	postProgress(id, { stage: "llm-model", status: "preparing-download" });
	const generator = await pipeline("text-generation", LOCAL_AI_MODEL_ID, {
		device: "webgpu",
		dtype: LOCAL_AI_DTYPE,
		progress_callback: (value) => {
			developmentLog("progress event", value);
			handlePipelineProgress(id, value);
		},
	});
	postModelInitStage(id);
	requestStages.set(id, "model-init");
	developmentLog("model initialization complete", {
		modelId: LOCAL_AI_MODEL_ID,
	});
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
	requestStages.set(
		request.id,
		request.type === "generate" ? "generation" : "download",
	);
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
		requestStages.set(request.id, "generation");
		developmentLog("generation start", { modelId: LOCAL_AI_MODEL_ID });
		postProgress(request.id, { stage: "generation", status: "running" });
		const result = await generator(request.messages, {
			max_new_tokens: 240,
			do_sample: false,
			repetition_penalty: 1.05,
			return_full_text: false,
		});
		developmentLog("generation complete", { modelId: LOCAL_AI_MODEL_ID });
		self.postMessage({
			id: request.id,
			type: "result",
			result: generatedText(result),
		});
	} catch (error) {
		const stage = classifyFailureStage(
			error,
			requestStages.get(request.id) ||
				(request.type === "generate" ? "generation" : "model-init"),
		);
		const diagnostic = createLocalAiFailureDiagnostic(
			stage,
			request.type === "initialize"
				? "model-pipeline-rejection"
				: "generation-rejection",
			error,
		);
		logLocalAiFailure(diagnostic);
		self.postMessage({
			id: request.id,
			type: "error",
			error: diagnostic.errorMessage,
			diagnostic,
		});
	} finally {
		requestStages.delete(request.id);
	}
});
