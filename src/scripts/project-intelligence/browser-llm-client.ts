import type {
	BrowserAiProgress,
	BrowserLocalLlmSnapshot,
} from "./browser-ai-types";

type LocalLlmListener = (snapshot: BrowserLocalLlmSnapshot) => void;
type LocalLlmRequestType = "initialize" | "generate";

interface PendingRequest {
	resolve: (value: unknown) => void;
	reject: (reason: Error) => void;
	onProgress?: (progress: BrowserAiProgress) => void;
}

export const BROWSER_LLM_MODEL_ID = "onnx-community/Qwen2.5-0.5B-Instruct";
export const BROWSER_LLM_INITIALIZATION_TIMEOUT_MS = 120_000;
export const BROWSER_LLM_GENERATION_TIMEOUT_MS = 60_000;

let worker: Worker | null = null;
let nextRequestId = 1;
const pending = new Map<number, PendingRequest>();
const listeners = new Set<LocalLlmListener>();
let snapshot: BrowserLocalLlmSnapshot = { state: "idle" };
let initializationPromise: Promise<void> | null = null;

function developmentLog(event: string, detail?: unknown): void {
	if (!import.meta.env.DEV) return;
	if (detail === undefined) {
		console.info(`[Project Intelligence local AI] ${event}`);
		return;
	}
	console.info(`[Project Intelligence local AI] ${event}`, detail);
}

function setSnapshot(next: BrowserLocalLlmSnapshot): void {
	snapshot = next;
	for (const listener of listeners) {
		try {
			listener(snapshot);
		} catch (error) {
			developmentLog("state listener error", error);
		}
	}
}

function terminateWorker(reason: string): void {
	worker?.terminate();
	worker = null;
	for (const request of pending.values()) request.reject(new Error(reason));
	pending.clear();
}

function fail(error: unknown): Error {
	const failure =
		error instanceof Error ? error : new Error("Local AI failed to start");
	terminateWorker(failure.message);
	setSnapshot({ state: "failed", error: failure.message });
	return failure;
}

function getWorker(): Worker {
	if (worker) return worker;
	worker = new Worker(new URL("./browser-llm.worker.ts", import.meta.url), {
		type: "module",
		name: "project-intelligence-local-llm",
	});
	worker.addEventListener("message", (event) => {
		const message = event.data as {
			id?: number;
			type?: string;
			progress?: BrowserAiProgress;
			result?: unknown;
			error?: string;
		};
		if (typeof message.id !== "number") return;
		const request = pending.get(message.id);
		if (!request) return;
		if (message.type === "progress" && message.progress) {
			developmentLog("progress event", message.progress);
			request.onProgress?.(message.progress);
			return;
		}
		pending.delete(message.id);
		if (message.type === "result") {
			request.resolve(message.result);
			return;
		}
		const messageText = message.error || "Local AI worker failed";
		developmentLog("worker error", messageText);
		request.reject(new Error(messageText));
	});
	worker.addEventListener("error", (event) => {
		developmentLog("worker error", {
			message: event.message,
			filename: event.filename,
			line: event.lineno,
		});
		fail(new Error(event.message || "Local AI worker failed"));
	});
	return worker;
}

function requestWorker(
	type: LocalLlmRequestType,
	payload: Record<string, unknown>,
	onProgress: ((progress: BrowserAiProgress) => void) | undefined,
	timeoutMs: number,
	timeoutMessage: string,
): Promise<unknown> {
	const id = nextRequestId++;
	return new Promise((resolve, reject) => {
		const timeoutId = globalThis.setTimeout(() => {
			if (!pending.has(id)) return;
			developmentLog("timeout", { type, timeoutMs });
			terminateWorker(timeoutMessage);
		}, timeoutMs);
		pending.set(id, {
			resolve(value) {
				globalThis.clearTimeout(timeoutId);
				resolve(value);
			},
			reject(error) {
				globalThis.clearTimeout(timeoutId);
				reject(error);
			},
			onProgress,
		});
		try {
			getWorker().postMessage({ id, type, ...payload });
		} catch (error) {
			const request = pending.get(id);
			pending.delete(id);
			request?.reject(
				error instanceof Error
					? error
					: new Error("Local AI request could not start"),
			);
		}
	});
}

async function logModelCacheVerification(): Promise<void> {
	if (!import.meta.env.DEV) return;
	if (!("caches" in globalThis)) {
		developmentLog("download complete", {
			modelId: BROWSER_LLM_MODEL_ID,
			browserCacheAvailable: false,
		});
		return;
	}
	try {
		const cache = await caches.open("transformers-cache");
		const keys = await cache.keys();
		const modelPath = BROWSER_LLM_MODEL_ID.toLowerCase();
		const modelEntries = keys.filter((request) =>
			decodeURIComponent(request.url).toLowerCase().includes(modelPath),
		);
		developmentLog("download complete", {
			modelId: BROWSER_LLM_MODEL_ID,
			browserCacheAvailable: true,
			cached: modelEntries.length > 0,
			cachedFileCount: modelEntries.length,
			cacheName: "transformers-cache",
		});
	} catch (error) {
		developmentLog("download complete", {
			modelId: BROWSER_LLM_MODEL_ID,
			browserCacheAvailable: true,
			cached: false,
			cacheInspectionError:
				error instanceof Error ? error.message : String(error),
		});
	}
}

export function getLocalBrowserModelState(): BrowserLocalLlmSnapshot {
	return snapshot;
}

export function subscribeLocalBrowserModel(
	listener: LocalLlmListener,
): () => void {
	listeners.add(listener);
	listener(snapshot);
	return () => listeners.delete(listener);
}

export function initializeLocalBrowserModel(): Promise<void> {
	if (snapshot.state === "ready" || snapshot.state === "generating") {
		return Promise.resolve();
	}
	if (snapshot.state === "loading" && initializationPromise) {
		return initializationPromise;
	}
	if (snapshot.state === "failed") {
		return Promise.reject(
			new Error(snapshot.error || "Local AI is unavailable"),
		);
	}

	developmentLog("model ID", BROWSER_LLM_MODEL_ID);
	setSnapshot({
		state: "loading",
		progress: { stage: "llm-model", status: "initializing-webgpu" },
	});
	const attempt = requestWorker(
		"initialize",
		{},
		(progress) => setSnapshot({ state: "loading", progress }),
		BROWSER_LLM_INITIALIZATION_TIMEOUT_MS,
		"Local AI model initialization timed out",
	)
		.then(() => {
			developmentLog("model initialization complete", {
				modelId: BROWSER_LLM_MODEL_ID,
			});
			setSnapshot({ state: "ready" });
			void logModelCacheVerification();
		})
		.catch((error) => {
			throw fail(error);
		});
	initializationPromise = attempt.finally(() => {
		initializationPromise = null;
	});
	return initializationPromise;
}

export async function generateInBrowser(
	messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
): Promise<string> {
	if (snapshot.state === "idle") await initializeLocalBrowserModel();
	else if (snapshot.state === "loading" && initializationPromise) {
		await initializationPromise;
	}
	if (snapshot.state === "failed") {
		throw new Error(snapshot.error || "Local AI is unavailable");
	}
	if (snapshot.state !== "ready") {
		throw new Error("Local AI is already generating an explanation");
	}

	setSnapshot({
		state: "generating",
		progress: { stage: "generation", status: "running" },
	});
	developmentLog("generation start", { modelId: BROWSER_LLM_MODEL_ID });
	try {
		const result = await requestWorker(
			"generate",
			{ messages },
			(progress) => setSnapshot({ state: "generating", progress }),
			BROWSER_LLM_GENERATION_TIMEOUT_MS,
			"Local AI explanation generation timed out",
		);
		if (typeof result !== "string") {
			throw new Error("Local AI returned an invalid explanation");
		}
		developmentLog("generation complete", { modelId: BROWSER_LLM_MODEL_ID });
		setSnapshot({ state: "ready" });
		return result;
	} catch (error) {
		throw fail(error);
	}
}
