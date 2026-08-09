import type {
	BrowserAiProgress,
	BrowserLocalLlmSnapshot,
} from "./browser-ai-types";
import {
	createLocalAiFailureDiagnostic,
	errorFromLocalAiDiagnostic,
	hasDeviceLostSignature,
	LOCAL_AI_MODEL_ID,
	type LocalAiDiagnosticStage,
	type LocalAiFailureDiagnostic,
	logLocalAiFailure,
} from "./browser-llm-diagnostics";

type LocalLlmListener = (snapshot: BrowserLocalLlmSnapshot) => void;
type LocalLlmRequestType = "initialize" | "generate";

interface RequestTimeout {
	timeoutMs: number;
	message: string;
	reason: string;
}

type TimerId = ReturnType<typeof globalThis.setTimeout>;

interface PendingRequest {
	resolve: (value: unknown) => void;
	reject: (reason: Error) => void;
	onProgress?: (progress: BrowserAiProgress) => void;
	type: LocalLlmRequestType;
	stage: LocalAiDiagnosticStage;
}

class LocalAiDiagnosticError extends Error {
	readonly diagnostic: LocalAiFailureDiagnostic;
	readonly logged: boolean;

	constructor(diagnostic: LocalAiFailureDiagnostic, logged: boolean) {
		const source = errorFromLocalAiDiagnostic(diagnostic);
		super(source.message);
		this.name = source.name;
		this.stack = source.stack;
		this.diagnostic = diagnostic;
		this.logged = logged;
	}
}

export const BROWSER_LLM_MODEL_ID = LOCAL_AI_MODEL_ID;
export const BROWSER_LLM_DOWNLOAD_TIMEOUT_MS = 600_000;
export const BROWSER_LLM_DOWNLOAD_STALL_TIMEOUT_MS = 90_000;
export const BROWSER_LLM_INITIALIZATION_TIMEOUT_MS = 120_000;
export const BROWSER_LLM_FIRST_GENERATION_FIRST_TOKEN_TIMEOUT_MS = 180_000;
export const BROWSER_LLM_SUBSEQUENT_FIRST_TOKEN_TIMEOUT_MS = 90_000;
export const BROWSER_LLM_TOKEN_INACTIVITY_TIMEOUT_MS = 30_000;
export const BROWSER_LLM_GENERATION_TIMEOUT_MS = 300_000;

let worker: Worker | null = null;
let nextRequestId = 1;
const pending = new Map<number, PendingRequest>();
const listeners = new Set<LocalLlmListener>();
let snapshot: BrowserLocalLlmSnapshot = { state: "idle" };
let initializationPromise: Promise<void> | null = null;
let activeGenerationRequestId: number | null = null;
let completedGenerations = 0;

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

function isWorkerDiagnostic(value: unknown): value is LocalAiFailureDiagnostic {
	if (!value || typeof value !== "object") return false;
	const record = value as Record<string, unknown>;
	return (
		["download", "model-init", "webgpu-init", "generation"].includes(
			String(record.stage),
		) &&
		typeof record.cause === "string" &&
		record.model === LOCAL_AI_MODEL_ID &&
		record.dtype === "q4" &&
		record.device === "webgpu" &&
		typeof record.errorName === "string" &&
		typeof record.errorMessage === "string" &&
		(record.errorStack === undefined || typeof record.errorStack === "string")
	);
}

function stageFromProgress(
	progress: BrowserAiProgress,
	fallback: LocalAiDiagnosticStage,
): LocalAiDiagnosticStage {
	if (progress.stage === "generation") return "generation";
	if (progress.stage === "llm-model") return "download";
	if (progress.stage === "model-init") return "model-init";
	return fallback;
}

function activeStage(): LocalAiDiagnosticStage {
	for (const request of pending.values()) {
		if (request.type === "generate") return "generation";
	}
	return pending.values().next().value?.stage || "model-init";
}

function logClientFailure(diagnostic: LocalAiFailureDiagnostic): void {
	logLocalAiFailure(diagnostic);
	if (
		diagnostic.errorName === "AbortError" &&
		diagnostic.cause !== "abort-error"
	) {
		logLocalAiFailure({ ...diagnostic, cause: "abort-error" });
	}
	if (
		hasDeviceLostSignature(diagnostic) &&
		diagnostic.cause !== "device-lost"
	) {
		logLocalAiFailure({
			...diagnostic,
			stage: "webgpu-init",
			cause: "device-lost",
		});
	}
}

function terminateWorker(
	failure: Error,
	trigger: LocalAiFailureDiagnostic,
	logTermination = true,
): void {
	if (worker && logTermination) {
		const terminationError = new Error(
			`Local AI worker terminated after ${trigger.cause}: ${failure.message}`,
		);
		terminationError.name = "WorkerTerminationError";
		logClientFailure(
			createLocalAiFailureDiagnostic(
				trigger.stage,
				"worker-termination",
				terminationError,
			),
		);
	}
	worker?.terminate();
	worker = null;
	activeGenerationRequestId = null;
	completedGenerations = 0;
	for (const request of pending.values()) request.reject(failure);
	pending.clear();
}

function fail(
	error: unknown,
	fallbackStage: LocalAiDiagnosticStage,
	fallbackCause: string,
): Error {
	const diagnostic =
		error instanceof LocalAiDiagnosticError
			? error.diagnostic
			: createLocalAiFailureDiagnostic(fallbackStage, fallbackCause, error);
	if (!(error instanceof LocalAiDiagnosticError) || !error.logged) {
		logClientFailure(diagnostic);
	}
	const failure =
		error instanceof LocalAiDiagnosticError
			? error
			: new LocalAiDiagnosticError(diagnostic, true);
	terminateWorker(failure, diagnostic);
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
			diagnostic?: unknown;
		};
		if (typeof message.id !== "number") return;
		const request = pending.get(message.id);
		if (!request) return;
		if (message.type === "progress" && message.progress) {
			developmentLog("progress event", message.progress);
			request.stage = stageFromProgress(message.progress, request.stage);
			request.onProgress?.(message.progress);
			return;
		}
		pending.delete(message.id);
		if (message.type === "result") {
			request.resolve(message.result);
			return;
		}
		if (message.type === "cancelled") {
			const error = new Error("Local AI explanation generation cancelled");
			error.name = "AbortError";
			request.reject(error);
			return;
		}
		const diagnostic = isWorkerDiagnostic(message.diagnostic)
			? message.diagnostic
			: createLocalAiFailureDiagnostic(
					request.stage,
					request.type === "initialize"
						? "model-pipeline-rejection"
						: "generation-rejection",
					new Error(message.error || "Local AI worker failed"),
				);
		logClientFailure(diagnostic);
		request.reject(new LocalAiDiagnosticError(diagnostic, true));
	});
	worker.addEventListener("error", (event) => {
		const source =
			event.error instanceof Error
				? event.error
				: new Error(event.message || "Local AI worker failed");
		const diagnostic = createLocalAiFailureDiagnostic(
			activeStage(),
			"worker-error",
			source,
		);
		logClientFailure(diagnostic);
		fail(
			new LocalAiDiagnosticError(diagnostic, true),
			diagnostic.stage,
			diagnostic.cause,
		);
	});
	worker.addEventListener("messageerror", () => {
		const error = new Error(
			"Local AI worker sent a message that could not be decoded",
		);
		error.name = "DataCloneError";
		const diagnostic = createLocalAiFailureDiagnostic(
			activeStage(),
			"worker-messageerror",
			error,
		);
		logClientFailure(diagnostic);
		fail(
			new LocalAiDiagnosticError(diagnostic, true),
			diagnostic.stage,
			diagnostic.cause,
		);
	});
	return worker;
}

function requestWorker(
	type: LocalLlmRequestType,
	payload: Record<string, unknown>,
	onProgress: ((progress: BrowserAiProgress) => void) | undefined,
	timeout?: RequestTimeout,
): Promise<unknown> {
	const id = nextRequestId++;
	if (type === "generate") activeGenerationRequestId = id;
	return new Promise((resolve, reject) => {
		let timeoutId: TimerId | undefined;
		if (timeout) {
			timeoutId = globalThis.setTimeout(() => {
				const request = pending.get(id);
				if (!request) return;
				const error = new Error(timeout.message);
				error.name = "TimeoutError";
				const diagnostic = createLocalAiFailureDiagnostic(
					request.stage,
					timeout.reason,
					error,
				);
				logClientFailure(diagnostic);
				const failure = new LocalAiDiagnosticError(diagnostic, true);
				terminateWorker(failure, diagnostic);
			}, timeout.timeoutMs);
		}
		const clearRequestTimeout = () => {
			if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
		};
		pending.set(id, {
			resolve(value) {
				clearRequestTimeout();
				if (activeGenerationRequestId === id) activeGenerationRequestId = null;
				resolve(value);
			},
			reject(error) {
				clearRequestTimeout();
				if (activeGenerationRequestId === id) activeGenerationRequestId = null;
				reject(error);
			},
			onProgress,
			type,
			stage: type === "generate" ? "generation" : "download",
		});
		try {
			getWorker().postMessage({ id, type, ...payload });
		} catch (error) {
			const request = pending.get(id);
			pending.delete(id);
			const diagnostic = createLocalAiFailureDiagnostic(
				request?.stage || (type === "generate" ? "generation" : "model-init"),
				"worker-start-error",
				error instanceof Error
					? error
					: new Error("Local AI request could not start"),
			);
			logClientFailure(diagnostic);
			request?.reject(new LocalAiDiagnosticError(diagnostic, true));
		}
	});
}

function requestModelInitialization(
	onProgress: (progress: BrowserAiProgress) => void,
): Promise<unknown> {
	let stage: "download" | "model-init" = "download";
	let downloadTimeoutId: TimerId | undefined;
	let downloadStallTimeoutId: TimerId | undefined;
	let initializationTimeoutId: TimerId | undefined;
	const observedProgress = new Map<
		string,
		{ loaded?: number; progress?: number }
	>();

	const clearTimer = (timerId: TimerId | undefined) => {
		if (timerId !== undefined) globalThis.clearTimeout(timerId);
	};
	const clearAllTimers = () => {
		clearTimer(downloadTimeoutId);
		clearTimer(downloadStallTimeoutId);
		clearTimer(initializationTimeoutId);
	};
	const failForTimeout = (
		timeoutStage: "download" | "model-init",
		reason: "download-timeout" | "initialization-timeout",
		message: string,
	) => {
		const error = new Error(message);
		error.name = "TimeoutError";
		const diagnostic = createLocalAiFailureDiagnostic(
			timeoutStage,
			reason,
			error,
		);
		logClientFailure(diagnostic);
		terminateWorker(new LocalAiDiagnosticError(diagnostic, true), diagnostic);
	};
	const resetDownloadStallTimeout = () => {
		clearTimer(downloadStallTimeoutId);
		downloadStallTimeoutId = globalThis.setTimeout(
			() =>
				failForTimeout(
					"download",
					"download-timeout",
					"Local AI model download made no progress for 90 seconds",
				),
			BROWSER_LLM_DOWNLOAD_STALL_TIMEOUT_MS,
		);
	};
	const enterModelInitialization = () => {
		if (stage === "model-init") return;
		stage = "model-init";
		clearTimer(downloadTimeoutId);
		clearTimer(downloadStallTimeoutId);
		initializationTimeoutId = globalThis.setTimeout(
			() =>
				failForTimeout(
					"model-init",
					"initialization-timeout",
					"Local AI WebGPU/model initialization timed out",
				),
			BROWSER_LLM_INITIALIZATION_TIMEOUT_MS,
		);
	};

	downloadTimeoutId = globalThis.setTimeout(
		() =>
			failForTimeout(
				"download",
				"download-timeout",
				"Local AI model download exceeded 10 minutes",
			),
		BROWSER_LLM_DOWNLOAD_TIMEOUT_MS,
	);
	resetDownloadStallTimeout();

	return requestWorker("initialize", {}, (progress) => {
		if (progress.stage === "model-init") {
			enterModelInitialization();
		} else if (stage === "download" && progress.stage === "llm-model") {
			const key = progress.file || progress.name || "model";
			const previous = observedProgress.get(key);
			const loaded =
				typeof progress.loaded === "number" && Number.isFinite(progress.loaded)
					? progress.loaded
					: undefined;
			const percentage =
				typeof progress.progress === "number" &&
				Number.isFinite(progress.progress)
					? progress.progress
					: undefined;
			if (
				(loaded !== undefined && loaded !== previous?.loaded) ||
				(percentage !== undefined && percentage !== previous?.progress)
			) {
				resetDownloadStallTimeout();
			}
			observedProgress.set(key, { loaded, progress: percentage });
		}
		onProgress(progress);
	}).finally(clearAllTimers);
}

function requestGeneration(
	messages: Array<{
		role: "system" | "user" | "assistant";
		content: string;
	}>,
	onProgress: (progress: BrowserAiProgress) => void,
): Promise<unknown> {
	let firstTokenTimeoutId: TimerId | undefined;
	let inactivityTimeoutId: TimerId | undefined;
	let overallTimeoutId: TimerId | undefined;
	let lastTokenCount = 0;
	let firstTokenSeen = false;

	const clearTimer = (timerId: TimerId | undefined) => {
		if (timerId !== undefined) globalThis.clearTimeout(timerId);
	};
	const clearAllTimers = () => {
		clearTimer(firstTokenTimeoutId);
		clearTimer(inactivityTimeoutId);
		clearTimer(overallTimeoutId);
	};
	const failForTimeout = (reason: string, message: string) => {
		if (activeGenerationRequestId === null) return;
		const error = new Error(message);
		error.name = "TimeoutError";
		const diagnostic = createLocalAiFailureDiagnostic(
			"generation",
			reason,
			error,
		);
		logClientFailure(diagnostic);
		terminateWorker(new LocalAiDiagnosticError(diagnostic, true), diagnostic);
	};
	const resetInactivityTimeout = () => {
		clearTimer(inactivityTimeoutId);
		inactivityTimeoutId = globalThis.setTimeout(
			() =>
				failForTimeout(
					"token-inactivity-timeout",
					"Local AI generation stopped producing tokens for 30 seconds",
				),
			BROWSER_LLM_TOKEN_INACTIVITY_TIMEOUT_MS,
		);
	};

	firstTokenTimeoutId = globalThis.setTimeout(
		() =>
			failForTimeout(
				"first-token-timeout",
				"Local AI generation did not produce a first token in time",
			),
		completedGenerations === 0
			? BROWSER_LLM_FIRST_GENERATION_FIRST_TOKEN_TIMEOUT_MS
			: BROWSER_LLM_SUBSEQUENT_FIRST_TOKEN_TIMEOUT_MS,
	);
	overallTimeoutId = globalThis.setTimeout(
		() =>
			failForTimeout(
				"generation-timeout",
				"Local AI explanation generation exceeded 5 minutes",
			),
		BROWSER_LLM_GENERATION_TIMEOUT_MS,
	);

	return requestWorker("generate", { messages }, (progress) => {
		const tokens =
			typeof progress.tokensGenerated === "number"
				? progress.tokensGenerated
				: 0;
		if (tokens > lastTokenCount) {
			lastTokenCount = tokens;
			if (!firstTokenSeen) {
				firstTokenSeen = true;
				clearTimer(firstTokenTimeoutId);
			}
			resetInactivityTimeout();
		}
		onProgress(progress);
	}).finally(clearAllTimers);
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

export function cancelLocalBrowserModel(): void {
	if (snapshot.state === "generating") {
		if (worker && activeGenerationRequestId !== null) {
			worker.postMessage({
				type: "cancel-generation",
				targetId: activeGenerationRequestId,
			});
			setSnapshot({
				state: "generating",
				progress: {
					...snapshot.progress,
					stage: "generation",
					status: "cancelling",
				},
			});
		}
		return;
	}
	if (snapshot.state !== "loading") return;
	const stage =
		snapshot.progress?.stage === "model-init" ? "model-init" : "download";
	const error = new DOMException(
		"Local AI model loading cancelled",
		"AbortError",
	);
	const diagnostic = createLocalAiFailureDiagnostic(
		stage,
		"user-cancelled",
		error,
	);
	terminateWorker(
		new LocalAiDiagnosticError(diagnostic, false),
		diagnostic,
		false,
	);
	setSnapshot({ state: "idle" });
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
		progress: { stage: "llm-model", status: "preparing-download" },
	});
	const attempt = requestModelInitialization((progress) =>
		setSnapshot({ state: "loading", progress }),
	)
		.then(() => {
			developmentLog("model initialization complete", {
				modelId: BROWSER_LLM_MODEL_ID,
			});
			setSnapshot({ state: "ready" });
			void logModelCacheVerification();
		})
		.catch((error) => {
			if (
				error instanceof LocalAiDiagnosticError &&
				error.diagnostic.cause === "user-cancelled"
			) {
				setSnapshot({ state: "idle" });
				throw error;
			}
			throw fail(error, "model-init", "model-initialization-failure");
		});
	const trackedAttempt = attempt.finally(() => {
		if (initializationPromise === trackedAttempt) initializationPromise = null;
	});
	initializationPromise = trackedAttempt;
	return trackedAttempt;
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
		progress: {
			stage: "generation",
			status:
				completedGenerations === 0 ? "preparing-first-generation" : "running",
			firstGeneration: completedGenerations === 0,
			tokensGenerated: 0,
		},
	});
	developmentLog("generation start", { modelId: BROWSER_LLM_MODEL_ID });
	try {
		const result = await requestGeneration(messages, (progress) =>
			setSnapshot({ state: "generating", progress }),
		);
		if (
			!result ||
			typeof result !== "object" ||
			typeof (result as { text?: unknown }).text !== "string" ||
			!(result as { timing?: unknown }).timing ||
			typeof (result as { timing?: unknown }).timing !== "object"
		) {
			throw new Error("Local AI returned an invalid explanation");
		}
		const generationResult = result as {
			text: string;
			timing: BrowserAiProgress;
		};
		completedGenerations += 1;
		developmentLog("generation complete", { modelId: BROWSER_LLM_MODEL_ID });
		setSnapshot({ state: "ready", progress: generationResult.timing });
		return generationResult.text;
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			setSnapshot({ state: "ready" });
			throw error;
		}
		throw fail(error, "generation", "generation-failure");
	}
}
