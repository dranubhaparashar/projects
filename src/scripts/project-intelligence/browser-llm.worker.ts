/// <reference lib="webworker" />

import {
	env,
	InterruptableStoppingCriteria,
	pipeline,
	StoppingCriteriaList,
	TextStreamer,
} from "@huggingface/transformers";
import type { BrowserAiProgress } from "./browser-ai-types";
import {
	createLocalAiFailureDiagnostic,
	hasDeviceLostSignature,
	hasGpuInstanceInvalidationSignature,
	LOCAL_AI_BROWSER_CACHE_NAME,
	LOCAL_AI_DTYPE,
	LOCAL_AI_MODEL_ID,
	type LocalAiDiagnosticStage,
	logLocalAiFailure,
} from "./browser-llm-diagnostics";

declare const self: DedicatedWorkerGlobalScope;

env.allowLocalModels = false;
env.useBrowserCache = true;
const MAX_NEW_TOKENS = 96;

type WorkerRequest =
	| { id: number; type: "initialize"; workerEpoch: number }
	| { targetId: number; type: "cancel-generation"; workerEpoch: number }
	| {
			id: number;
			type: "generate";
			workerEpoch: number;
			messages: Array<{
				role: "system" | "user" | "assistant";
				content: string;
			}>;
	  };

let generationPipelinePromise: ReturnType<
	typeof createGenerationPipeline
> | null = null;
let workerEpoch: number | null = null;
let gpuRuntimeInvalidated = false;
const requestStages = new Map<number, LocalAiDiagnosticStage>();
interface DownloadFileProgress {
	file: string;
	loaded: number;
	total: number;
	totalKnown: boolean;
	loadSource?: "network" | "browser-cache";
}

const activeDownloads = new Set<string>();
const downloadProgressByFile = new Map<string, DownloadFileProgress>();
const browserCacheLookups = new Map<string, boolean>();
let trackedBrowserCacheConfigured = false;
let modelArtifactDownloaded = false;
let modelInitStagePosted = false;
let modelInitializedAt = "";
let completedGenerations = 0;
const cancelledRequests = new Set<number>();
let activeGeneration:
	| { id: number; stoppingCriteria: InterruptableStoppingCriteria }
	| undefined;

function developmentLog(event: string, detail?: unknown): void {
	if (!import.meta.env.DEV) return;
	if (detail === undefined) {
		console.info(`[Project Intelligence local AI worker] ${event}`);
		return;
	}
	console.info(`[Project Intelligence local AI worker] ${event}`, detail);
}

function developmentTimingLog(lines: string[]): void {
	if (!import.meta.env.DEV) return;
	console.info(["[Project Intelligence Local AI]", ...lines].join("\n"));
}

function developmentValidationLog(value: unknown, text: string): void {
	if (!import.meta.env.DEV) return;
	const candidate = Array.isArray(value) ? value[0] : undefined;
	const generated =
		candidate && typeof candidate === "object"
			? (candidate as { generated_text?: unknown }).generated_text
			: undefined;
	const messages = Array.isArray(generated)
		? (generated as Array<{ role?: unknown }>)
		: [];
	const structure = {
		resultType: Array.isArray(value) ? "array" : typeof value,
		resultCount: Array.isArray(value) ? value.length : 0,
		generatedTextType: Array.isArray(generated) ? "chat" : typeof generated,
		chatMessageCount: messages.length,
		chatRoles: messages.map((message) =>
			typeof message?.role === "string" ? message.role : "unknown",
		),
	};
	console.info(
		[
			"[Project Intelligence Local AI validation]",
			`raw output structure: ${JSON.stringify(structure)}`,
			`raw generated assistant output: ${text}`,
		].join("\n"),
	);
}

function postWorkerMessage(message: Record<string, unknown>): void {
	self.postMessage({ ...message, workerEpoch });
}

function activeRuntimeStage(): LocalAiDiagnosticStage {
	if (activeGeneration) return "generation";
	return requestStages.values().next().value || "webgpu-runtime";
}

function clearGpuRuntimeState(): void {
	activeGeneration?.stoppingCriteria.interrupt();
	activeGeneration = undefined;
	generationPipelinePromise = null;
	requestStages.clear();
	activeDownloads.clear();
	downloadProgressByFile.clear();
	browserCacheLookups.clear();
	cancelledRequests.clear();
	modelArtifactDownloaded = false;
	modelInitStagePosted = false;
	modelInitializedAt = "";
	completedGenerations = 0;
}

function reportGpuRuntimeInvalidation(error: unknown, id?: number): void {
	if (gpuRuntimeInvalidated) return;
	const stage = activeRuntimeStage();
	gpuRuntimeInvalidated = true;
	const diagnostic = createLocalAiFailureDiagnostic(
		"webgpu-runtime",
		"gpu-instance-invalidated",
		error,
	);
	logLocalAiFailure(diagnostic);
	clearGpuRuntimeState();
	postWorkerMessage({
		id,
		type: "fatal",
		error: diagnostic.errorMessage,
		diagnostic,
		previousStage: stage,
	});
}

self.addEventListener("unhandledrejection", (event) => {
	event.preventDefault();
	reportGpuRuntimeInvalidation(event.reason);
});

self.addEventListener("error", (event) => {
	event.preventDefault();
	reportGpuRuntimeInvalidation(
		event.error instanceof Error
			? event.error
			: new Error(event.message || "Local AI worker failed"),
	);
});

function postProgress(id: number, progress: BrowserAiProgress): void {
	postWorkerMessage({
		id,
		type: "progress",
		progress,
	});
}

function downloadKey(record: Record<string, unknown>): string {
	return `${String(record.name || LOCAL_AI_MODEL_ID)}::${String(record.file || "unknown")}`;
}

function normalizedCacheRequest(request: RequestInfo | URL): string {
	const raw =
		request instanceof Request
			? request.url
			: request instanceof URL
				? request.href
				: String(request);
	try {
		return decodeURIComponent(raw).replace(/\\/g, "/").toLowerCase();
	} catch {
		return raw.replace(/\\/g, "/").toLowerCase();
	}
}

function cacheLoadSource(
	record: Record<string, unknown>,
): "network" | "browser-cache" | undefined {
	const model = String(record.name || LOCAL_AI_MODEL_ID).toLowerCase();
	const file = String(record.file || "")
		.replace(/\\/g, "/")
		.toLowerCase();
	if (!file) return undefined;
	const matchingLookups = [...browserCacheLookups.entries()].filter(
		([request]) => request.includes(model) && request.endsWith(file),
	);
	if (matchingLookups.some(([, hit]) => hit)) return "browser-cache";
	if (matchingLookups.length) return "network";
	return undefined;
}

async function configureTrackedBrowserCache(): Promise<void> {
	if (trackedBrowserCacheConfigured || !("caches" in globalThis)) return;
	try {
		const browserCache = await caches.open(LOCAL_AI_BROWSER_CACHE_NAME);
		env.customCache = {
			async match(
				request: RequestInfo | URL,
				options?: CacheQueryOptions,
			): Promise<Response | undefined> {
				const response = await browserCache.match(request, options);
				browserCacheLookups.set(
					normalizedCacheRequest(request),
					response !== undefined,
				);
				return response;
			},
			put(request: RequestInfo | URL, response: Response): Promise<void> {
				return browserCache.put(request, response);
			},
		};
		env.useCustomCache = true;
		trackedBrowserCacheConfigured = true;
		developmentLog("browser model cache configured", {
			cacheMechanism: "Cache Storage",
			cacheName: LOCAL_AI_BROWSER_CACHE_NAME,
		});
	} catch (error) {
		developmentLog("browser model cache inspection unavailable", error);
	}
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
		loadSource: cacheLoadSource(record),
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
		loadSource: current?.loadSource ?? cacheLoadSource(record),
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
	if (hasGpuInstanceInvalidationSignature(diagnostic)) {
		return "webgpu-runtime";
	}
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

interface ObservableGpuDevice {
	lost: Promise<{ message?: unknown; reason?: unknown }>;
}

function observeGpuDevice(): void {
	const backend = env.backends.onnx as
		| { webgpu?: { device?: ObservableGpuDevice } }
		| undefined;
	const device = backend?.webgpu?.device;
	if (!device?.lost) return;
	void device.lost
		.then((info) => {
			const reason = String(info?.reason || "unknown");
			const message = String(info?.message || "WebGPU device was lost");
			const error = new Error(`WebGPU device lost (${reason}): ${message}`);
			error.name = "GPUDeviceLostError";
			reportGpuRuntimeInvalidation(error);
		})
		.catch((error) => reportGpuRuntimeInvalidation(error));
}

async function createGenerationPipeline(id: number) {
	requestStages.set(id, "download");
	developmentLog("model ID", LOCAL_AI_MODEL_ID);
	postProgress(id, { stage: "llm-model", status: "checking-cache" });
	await configureTrackedBrowserCache();
	const generator = await pipeline("text-generation", LOCAL_AI_MODEL_ID, {
		device: "webgpu",
		dtype: LOCAL_AI_DTYPE,
		progress_callback: (value) => {
			developmentLog("progress event", value);
			handlePipelineProgress(id, value);
		},
	});
	if (gpuRuntimeInvalidated) {
		throw new Error(
			"WebGPU runtime was invalidated during model initialization",
		);
	}
	postModelInitStage(id);
	requestStages.set(id, "model-init");
	modelInitializedAt = new Date().toISOString();
	developmentLog("model initialization complete", {
		modelId: LOCAL_AI_MODEL_ID,
		modelInitializedAt,
	});
	observeGpuDevice();
	return generator;
}

function getGenerationPipeline(id: number) {
	if (gpuRuntimeInvalidated) {
		return Promise.reject(
			new Error("WebGPU runtime is stale and cannot be reused"),
		);
	}
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
	if (workerEpoch === null) workerEpoch = request.workerEpoch;
	if (request.workerEpoch !== workerEpoch || gpuRuntimeInvalidated) return;
	if (request.type === "cancel-generation") {
		if (activeGeneration?.id === request.targetId) {
			cancelledRequests.add(request.targetId);
			activeGeneration.stoppingCriteria.interrupt();
		}
		return;
	}
	requestStages.set(
		request.id,
		request.type === "generate" ? "generation" : "download",
	);
	try {
		if (request.type === "initialize") {
			await getGenerationPipeline(request.id);
			postWorkerMessage({ id: request.id, type: "result", result: "ready" });
			return;
		}

		if (!generationPipelinePromise) {
			throw new Error("Local AI model has not been initialized");
		}
		const generator = await generationPipelinePromise;
		requestStages.set(request.id, "generation");
		const firstGeneration = completedGenerations === 0;
		const generationStartedAt = new Date().toISOString();
		const generationStart = performance.now();
		let firstTokenAt = "";
		let firstTokenTime: number | undefined;
		let tokensGenerated = 0;
		let lastGeneratedTokenId: number | undefined;
		const stoppingCriteria = new InterruptableStoppingCriteria();
		const stoppingCriteriaList = new StoppingCriteriaList();
		stoppingCriteriaList.push(stoppingCriteria);
		activeGeneration = { id: request.id, stoppingCriteria };
		developmentTimingLog([
			"generation start",
			`model initialized at: ${modelInitializedAt}`,
			`generation started at: ${generationStartedAt}`,
		]);
		postProgress(request.id, {
			stage: "generation",
			status: firstGeneration ? "preparing-first-generation" : "running",
			firstGeneration,
			modelInitializedAt,
			generationStartedAt,
			tokensGenerated,
		});
		const streamer = new TextStreamer(generator.tokenizer, {
			skip_prompt: true,
			callback_function: () => {},
			token_callback_function: (tokens) => {
				tokensGenerated += tokens.length;
				const lastToken = tokens.at(-1);
				if (lastToken !== undefined) {
					lastGeneratedTokenId = Number(lastToken);
				}
				if (firstTokenTime === undefined) {
					firstTokenTime = performance.now();
					firstTokenAt = new Date().toISOString();
					developmentTimingLog([
						`first-token latency: ${(
							(firstTokenTime - generationStart) / 1_000
						).toFixed(2)} seconds`,
						`first token at: ${firstTokenAt}`,
					]);
				}
				postProgress(request.id, {
					stage: "generation",
					status: "tokens",
					firstGeneration,
					modelInitializedAt,
					generationStartedAt,
					firstTokenAt,
					firstTokenLatencyMs: firstTokenTime - generationStart,
					tokensGenerated,
				});
			},
		});
		try {
			const result = await generator(request.messages, {
				min_new_tokens: 32,
				max_new_tokens: MAX_NEW_TOKENS,
				do_sample: false,
				return_full_text: false,
				streamer,
				// The pipeline forwards this supported model.generate() option, but
				// Transformers.js 3.8.1 omits it from TextGenerationConfig's types.
				// @ts-expect-error stopping_criteria is a supported generation option
				stopping_criteria: stoppingCriteriaList,
			});
			if (stoppingCriteria.interrupted) {
				cancelledRequests.delete(request.id);
				postWorkerMessage({ id: request.id, type: "cancelled" });
				return;
			}
			const generationCompletedAt = new Date().toISOString();
			const generationComplete = performance.now();
			const generationTotalMs = generationComplete - generationStart;
			const eosTokenObserved =
				lastGeneratedTokenId === generator.tokenizer.eos_token_id;
			const finishReason = eosTokenObserved
				? "eos"
				: tokensGenerated >= MAX_NEW_TOKENS
					? "max-new-tokens"
					: "completed";
			const tokenGenerationMs = Math.max(
				generationComplete - (firstTokenTime ?? generationStart),
				1,
			);
			const tokensPerSecond = (tokensGenerated * 1_000) / tokenGenerationMs;
			completedGenerations += 1;
			const timing: BrowserAiProgress = {
				stage: "generation",
				status: "complete",
				firstGeneration,
				modelInitializedAt,
				generationStartedAt,
				firstTokenAt: firstTokenAt || undefined,
				generationCompletedAt,
				firstTokenLatencyMs:
					firstTokenTime === undefined
						? undefined
						: firstTokenTime - generationStart,
				generationTotalMs,
				tokensGenerated,
				tokensPerSecond,
				finishReason,
				eosTokenObserved,
			};
			const extractedText = generatedText(result);
			developmentValidationLog(result, extractedText);
			developmentTimingLog([
				`generation completed at: ${generationCompletedAt}`,
				`tokens generated: ${tokensGenerated}`,
				`generation speed: ${tokensPerSecond.toFixed(2)} tokens/sec`,
				`generation total: ${(generationTotalMs / 1_000).toFixed(2)} seconds`,
				`finish reason: ${finishReason}`,
			]);
			postProgress(request.id, timing);
			postWorkerMessage({
				id: request.id,
				type: "result",
				result: { text: extractedText, timing },
			});
		} finally {
			if (activeGeneration?.id === request.id) activeGeneration = undefined;
		}
	} catch (error) {
		if (cancelledRequests.delete(request.id)) {
			postWorkerMessage({ id: request.id, type: "cancelled" });
			return;
		}
		const candidate = createLocalAiFailureDiagnostic(
			request.type === "generate" ? "generation" : "model-init",
			"failure-classification",
			error,
		);
		if (hasGpuInstanceInvalidationSignature(candidate)) {
			reportGpuRuntimeInvalidation(error, request.id);
			return;
		}
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
		postWorkerMessage({
			id: request.id,
			type: "error",
			error: diagnostic.errorMessage,
			diagnostic,
		});
	} finally {
		requestStages.delete(request.id);
	}
});
