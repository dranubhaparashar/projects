import type { BrowserAiProgress } from "./browser-ai-types";

type ProgressCallback = (progress: BrowserAiProgress) => void;

interface PendingRequest {
	resolve: (value: unknown) => void;
	reject: (reason: Error) => void;
	onProgress?: ProgressCallback;
}

let worker: Worker | null = null;
let nextRequestId = 1;
const pending = new Map<number, PendingRequest>();

function resetWorker(reason = "Browser AI operation cancelled"): void {
	worker?.terminate();
	worker = null;
	for (const request of pending.values()) request.reject(new Error(reason));
	pending.clear();
}

function getWorker(): Worker {
	if (worker) return worker;
	worker = new Worker(new URL("./browser-ai.worker.ts", import.meta.url), {
		type: "module",
		name: "project-intelligence-ai",
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
			request.onProgress?.(message.progress);
			return;
		}
		pending.delete(message.id);
		if (message.type === "result") request.resolve(message.result);
		else request.reject(new Error(message.error || "Browser inference failed"));
	});
	worker.addEventListener("error", () =>
		resetWorker("Browser AI worker failed"),
	);
	return worker;
}

function requestWorker(
	type: "embed" | "generate",
	payload: Record<string, unknown>,
	onProgress?: ProgressCallback,
	signal?: AbortSignal,
): Promise<unknown> {
	if (signal?.aborted)
		return Promise.reject(new DOMException("Aborted", "AbortError"));
	const id = nextRequestId++;
	return new Promise((resolve, reject) => {
		const abort = () => resetWorker("Browser AI operation cancelled");
		signal?.addEventListener("abort", abort, { once: true });
		pending.set(id, {
			resolve(value) {
				signal?.removeEventListener("abort", abort);
				resolve(value);
			},
			reject(error) {
				signal?.removeEventListener("abort", abort);
				reject(error);
			},
			onProgress,
		});
		getWorker().postMessage({ id, type, ...payload });
	});
}

export async function embedInBrowser(
	text: string,
	onProgress?: ProgressCallback,
	signal?: AbortSignal,
): Promise<Float32Array> {
	const result = await requestWorker("embed", { text }, onProgress, signal);
	if (!(result instanceof ArrayBuffer))
		throw new Error("Invalid embedding result");
	return new Float32Array(result);
}

export async function generateInBrowser(
	messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
	onProgress?: ProgressCallback,
	signal?: AbortSignal,
): Promise<string> {
	const result = await requestWorker(
		"generate",
		{ messages },
		onProgress,
		signal,
	);
	if (typeof result !== "string") throw new Error("Invalid generation result");
	return result;
}

export function cancelBrowserAi(): void {
	resetWorker();
}
