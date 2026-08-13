import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const baseUrl = process.argv[2] || "http://127.0.0.1:4321/projects/";
const reusedProfile =
	Boolean(process.argv[3]) && !process.argv.includes("--fresh-profile");
const cacheOnly = process.argv.includes("--cache-only");
const cacheLifecycleOnly = process.argv.includes("--cache-lifecycle");
const profile =
	process.argv[3] ||
	join(tmpdir(), `project-intelligence-webgpu-${Date.now()}`);
const requests = [];
const consoleMessages = [];
const consoleErrors = [];

const context = await chromium.launchPersistentContext(profile, {
	channel: "msedge",
	headless: false,
	viewport: { width: 1440, height: 1000 },
	args: [
		"--enable-unsafe-webgpu",
		"--enable-features=WebGPU",
		"--disable-background-timer-throttling",
		"--disable-backgrounding-occluded-windows",
		"--disable-renderer-backgrounding",
		"--no-first-run",
		"--window-position=40,40",
	],
});

await context.addInitScript(() => {
	const NativeWorker = window.Worker;
	const workerUrls = [];
	Object.defineProperty(window, "__projectIntelligenceWorkerUrls", {
		configurable: false,
		value: workerUrls,
	});
	window.Worker = function ProjectIntelligenceQaWorker(url, options) {
		workerUrls.push(String(url));
		return new NativeWorker(url, options);
	};
	window.Worker.prototype = NativeWorker.prototype;
	Object.setPrototypeOf(window.Worker, NativeWorker);
});

const page = context.pages()[0] || (await context.newPage());
page.on("request", (request) => {
	requests.push({
		method: request.method(),
		url: request.url(),
		postData: request.postData() || "",
	});
});
page.on("console", (message) => {
	const value = `[${message.type()}] ${message.text()}`;
	consoleMessages.push(value);
	if (message.type() === "error") consoleErrors.push(value);
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

if (cacheOnly) {
	await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 120_000 });
	const cacheReport = await browserCacheReport();
	console.log(
		JSON.stringify(
			{
				status: "cache-inspected",
				...cacheReport,
				qwenNetworkRequests: qwenRequests().length,
			},
			null,
			2,
		),
	);
	await context.close();
	process.exit(0);
}

async function browserCacheReport() {
	return page.evaluate(async () => {
		const cache = await caches.open("transformers-cache");
		const keys = await cache.keys();
		const modelEntries = keys
			.map((request) => decodeURIComponent(request.url))
			.filter((url) => /Qwen2\.5-0\.5B-Instruct/i.test(url));
		return {
			cacheName: "transformers-cache",
			modelEntries,
			modelEntryCount: modelEntries.length,
		};
	});
}

function qwenRequests() {
	return requests.filter((request) =>
		/Qwen2\.5-0\.5B-Instruct/i.test(request.url),
	);
}

async function waitForSwupReady() {
	await page.waitForFunction(
		() => {
			const html = document.documentElement;
			const main = document.querySelector("main");
			return (
				!html.classList.contains("is-changing") &&
				!html.classList.contains("is-animating") &&
				!(main instanceof HTMLElement && main.inert)
			);
		},
		undefined,
		{ timeout: 30_000 },
	);
}

async function openDrawer() {
	const layer = page.locator("[data-project-intelligence-layer]");
	if ((await layer.getAttribute("data-open")) === "true") return;
	await page.locator("[data-project-intelligence-trigger]").click();
	await page.waitForFunction(
		() =>
			document
				.querySelector("[data-project-intelligence-layer]")
				?.getAttribute("data-open") === "true",
	);
}

async function closeDrawer() {
	const layer = page.locator("[data-project-intelligence-layer]");
	if ((await layer.getAttribute("data-open")) !== "true") return;
	await page
		.getByRole("button", { name: "Close Project Intelligence" })
		.last()
		.click();
	await page.waitForFunction(
		() =>
			document.querySelector("[data-project-intelligence-layer]")?.hidden ===
			true,
	);
}

async function navigateWithSwup(path) {
	const link = page.locator(`a[href="${path}"]`).first();
	await link.scrollIntoViewIfNeeded();
	await link.click();
	await page.waitForURL((url) => url.pathname === path, { timeout: 30_000 });
	await waitForSwupReady();
}

async function localLlmWorkerCount() {
	const workerUrls = await page.evaluate(
		() => window.__projectIntelligenceWorkerUrls || [],
	);
	return workerUrls.filter((url) => /browser-llm\.worker/i.test(url)).length;
}

async function askGrounded(question) {
	const existingAnswers = await page
		.locator(".project-intelligence-mode-note")
		.filter({ hasText: "Browser-local RAG" })
		.count();
	const form = page.locator("[data-project-intelligence-form]");
	await page.locator("[data-project-intelligence-input]").fill(question);
	await form.getByRole("button", { name: "Ask Project Intelligence" }).click();
	await page.waitForFunction(
		() =>
			document
				.querySelector("[data-project-intelligence-form]")
				?.getAttribute("aria-busy") === "true",
		undefined,
		{ timeout: 10_000 },
	);
	await page.waitForFunction(
		(expected) => {
			const ragCount = [
				...document.querySelectorAll(".project-intelligence-mode-note"),
			].filter((node) => node.textContent?.includes("Browser-local RAG")).length;
			const form = document.querySelector("[data-project-intelligence-form]");
			return (
				ragCount > expected ||
				(form?.getAttribute("aria-busy") !== "true" &&
					Boolean(
						document.querySelector(
							".project-intelligence-message.is-assistant:not(.is-loading)",
						),
					))
			);
		},
		existingAnswers,
		{ timeout: 300_000 },
	);
	await page.waitForFunction(
		() =>
			document
				.querySelector("[data-project-intelligence-form]")
				?.getAttribute("aria-busy") !== "true",
		undefined,
		{ timeout: 10_000 },
	);
	const assistant = page
		.locator(".project-intelligence-message.is-assistant")
		.filter({ has: page.getByText("Browser-local RAG", { exact: true }) })
		.last();
	if ((await assistant.count()) === 0) {
		const diagnostic = await page.evaluate(() => ({
			modeNotes: [
				...document.querySelectorAll(".project-intelligence-mode-note"),
			].map((node) => node.textContent?.trim() || ""),
			assistantMessages: [
				...document.querySelectorAll(
					".project-intelligence-message.is-assistant",
				),
			].map((node) => node.textContent?.trim().slice(0, 500) || ""),
			statusMessages: [
				...document.querySelectorAll(".project-intelligence-ai-status"),
			].map((node) => node.textContent?.trim() || ""),
		}));
		throw new Error(`Browser RAG failed: ${JSON.stringify(diagnostic)}`);
	}
	return assistant;
}

async function generateExplanation(answerMessage) {
	const explanationCount = await page
		.locator(".project-intelligence-local-ai-explanation")
		.count();
	const controls = answerMessage.locator(".project-intelligence-local-ai");
	await controls.evaluate((node) => {
		const states = [];
		const statuses = [];
		const downloadDetails = [];
		const cancelVisibility = [];
		const record = () => {
			const state = node.getAttribute("data-local-ai-state") || "";
			const status =
				node
					.querySelector(".project-intelligence-local-ai-status")
					?.textContent?.trim() || "";
			const downloadDetail =
				node
					.querySelector(".project-intelligence-local-ai-download-detail")
					?.textContent?.trim() || "";
			if (state && states.at(-1) !== state) states.push(state);
			if (status && statuses.at(-1) !== status) statuses.push(status);
			if (downloadDetail && downloadDetails.at(-1) !== downloadDetail) {
				downloadDetails.push(downloadDetail);
			}
			const cancel = node.querySelector(
				".project-intelligence-local-ai-cancel",
			);
			const cancelVisible = Boolean(cancel && !cancel.hidden);
			if (cancelVisibility.at(-1) !== cancelVisible) {
				cancelVisibility.push(cancelVisible);
			}
		};
		const observer = new MutationObserver(record);
		observer.observe(node, {
			attributes: true,
			childList: true,
			characterData: true,
			subtree: true,
		});
		Reflect.set(node, "__localAiQa", {
			observer,
			record,
			states,
			statuses,
			downloadDetails,
			cancelVisibility,
		});
		record();
	});
	await answerMessage
		.getByRole("button", { name: "Generate deeper local AI explanation" })
		.click();
	const deadline = Date.now() + 800_000;
	while (Date.now() < deadline) {
		const state = await controls.getAttribute("data-local-ai-state");
		const status = (
			(await controls
				.locator(".project-intelligence-local-ai-status")
				.textContent()
				.catch(() => "")) || ""
		).trim();
		if (
			(await page
				.locator(".project-intelligence-local-ai-explanation")
				.count()) > explanationCount
		) {
			return controls.evaluate((node) => {
				const tracker = Reflect.get(node, "__localAiQa");
				tracker.record();
				tracker.observer.disconnect();
				return {
					statuses: tracker.statuses,
					states: tracker.states,
					downloadDetails: tracker.downloadDetails,
					cancelVisibility: tracker.cancelVisibility,
					timing: {
						firstTokenLatencyMs: Number(node.dataset.generationFirstTokenMs),
						generationTotalMs: Number(node.dataset.generationTotalMs),
						tokensGenerated: Number(node.dataset.generationTokens),
						tokensPerSecond: Number(node.dataset.generationTokensPerSecond),
					},
				};
			});
		}
		if (state === "failed") {
			throw new Error(`Local AI failed: ${status}`);
		}
		await page.waitForTimeout(100);
	}
	throw new Error("Local AI explanation exceeded its hard timeout envelope");
}

try {
	await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 120_000 });
	const capabilities = await page.evaluate(async () => {
		if (!navigator.gpu) {
			return { navigatorGpu: false, adapter: false, features: [] };
		}
		const adapter = await navigator.gpu.requestAdapter();
		return {
			navigatorGpu: true,
			adapter: Boolean(adapter),
			features: adapter ? [...adapter.features] : [],
		};
	});
	if (!capabilities.adapter || !capabilities.features.includes("shader-f16")) {
		console.log(
			JSON.stringify(
				{
					status: "unsupported",
					capabilities,
					message:
						"The installed Edge/GPU combination did not expose a shader-f16 WebGPU adapter.",
				},
				null,
				2,
			),
		);
		process.exitCode = 2;
	} else {
		await openDrawer();
		const qwenBeforeFirstQuestion = qwenRequests().length;
		const firstAnswer = await askGrounded(
			"Which work deals with privacy-preserving credentials?",
		);
		const qwenAfterFirstAnswer = qwenRequests().length;
		if (qwenAfterFirstAnswer !== qwenBeforeFirstQuestion) {
			throw new Error("Qwen downloaded before explicit visitor consent");
		}
		if (
			(await page
				.getByText("Loading local AI model for the first answer", {
					exact: false,
				})
				.count()) > 0
		) {
			throw new Error("The obsolete first-answer loader was rendered");
		}
		const localModelDiagnostic = (
			(await firstAnswer
				.locator(".project-intelligence-local-ai-model")
				.textContent({ timeout: 10_000 })
				.catch(async () => {
					const diagnostic = await firstAnswer.evaluate((node) => ({
						text: node.textContent?.trim() || "",
						html: node.innerHTML.slice(0, 4_000),
					}));
					throw new Error(
						`Local-AI controls were not rendered: ${JSON.stringify(diagnostic)}`,
					);
				})) || ""
		).trim();
		if (
			localModelDiagnostic !==
			"Local model: Qwen2.5-0.5B-Instruct · q4 · WebGPU"
		) {
			throw new Error(
				`Unexpected local-model diagnostic: ${localModelDiagnostic}`,
			);
		}
		const localCacheDiagnostic = (
			(await firstAnswer
				.locator(".project-intelligence-local-ai-cache")
				.textContent()) || ""
		).trim();
		if (
			localCacheDiagnostic !==
			"Model cache: Browser Cache Storage (transformers-cache)"
		) {
			throw new Error(
				`Unexpected local-model cache diagnostic: ${localCacheDiagnostic}`,
			);
		}

		const firstGeneration = await generateExplanation(firstAnswer);
		const qwenAfterFirstGeneration = qwenRequests().length;
		if (!reusedProfile && qwenAfterFirstGeneration <= qwenAfterFirstAnswer) {
			throw new Error(
				"Qwen did not start downloading after the explicit click",
			);
		}
		if (!firstGeneration.states.includes("ready")) {
			throw new Error("The local model never reached ready state");
		}
		if (!firstGeneration.states.includes("generating")) {
			throw new Error("The local model never entered generating state");
		}
		if (!firstGeneration.cancelVisibility.includes(true)) {
			throw new Error("The model download never exposed its Cancel control");
		}
		for (const expectedStatus of [
			"Loading local AI model…",
			"Local AI ready",
			"Preparing WebGPU for first generation…",
		]) {
			if (!firstGeneration.statuses.includes(expectedStatus)) {
				throw new Error(`Missing local-AI progress state: ${expectedStatus}`);
			}
		}
		if (
			!firstGeneration.statuses.some((status) =>
				/^Generating deeper explanation… \d+ tokens?$/.test(status),
			)
		) {
			throw new Error("First generation never exposed streamed token progress");
		}
		if (
			firstGeneration.timing.tokensGenerated < 1 ||
			firstGeneration.timing.tokensGenerated > 96 ||
			firstGeneration.timing.firstTokenLatencyMs <= 0 ||
			firstGeneration.timing.generationTotalMs <= 0 ||
			firstGeneration.timing.tokensPerSecond <= 0
		) {
			throw new Error(
				`Invalid first-generation timing: ${JSON.stringify(firstGeneration.timing)}`,
			);
		}
		const showedRealPercentage = firstGeneration.statuses.some((status) =>
			/^Downloading local AI model — \d+%$/.test(status),
		);
		const showedUnknownTotalBytes =
			firstGeneration.statuses.includes("Downloading local AI model…") &&
			firstGeneration.downloadDetails.some((detail) =>
				/^Downloaded [\d,.]+ MB$/.test(detail),
			);
		if (!reusedProfile && !showedRealPercentage && !showedUnknownTotalBytes) {
			throw new Error(
				"No honest Transformers.js download percentage or byte count was shown",
			);
		}
		const showedNetworkDownload = firstGeneration.statuses.some((status) =>
			status.startsWith("Downloading local AI model"),
		);
		if (!reusedProfile && !showedNetworkDownload) {
			throw new Error(
				"The first generation never exposed its network download",
			);
		}
		if (reusedProfile && showedNetworkDownload) {
			throw new Error(
				"A cached model load was incorrectly labeled as a network download",
			);
		}
		if (
			reusedProfile &&
			!firstGeneration.downloadDetails.some((detail) =>
				detail.startsWith("Loaded "),
			)
		) {
			throw new Error("A cached model load never exposed cached byte progress");
		}
		const firstCacheReport = await browserCacheReport();
		if (firstCacheReport.modelEntryCount < 1) {
			throw new Error("Qwen model files were not persisted in Cache Storage");
		}
		if (reusedProfile && qwenAfterFirstGeneration !== qwenAfterFirstAnswer) {
			throw new Error(
				"Reopening the browser profile redownloaded Qwen instead of using Cache Storage",
			);
		}

		if ((await localLlmWorkerCount()) !== 1) {
			throw new Error("Expected one local-LLM worker before Swup navigation");
		}
		let sameSessionGeneration = null;
		let refreshedGeneration = null;
		if (!reusedProfile) {
			const qwenBeforeSecondQuestion = qwenRequests().length;
			const secondAnswer = await askGrounded(
				"Which project involves autonomous agent orchestration?",
			);
			sameSessionGeneration = await generateExplanation(secondAnswer);
			if (qwenRequests().length !== qwenBeforeSecondQuestion) {
				throw new Error(
					"A second question in the same session redownloaded Qwen",
				);
			}
			if (
				sameSessionGeneration.statuses.some((status) =>
					status.startsWith("Downloading local AI model"),
				)
			) {
				throw new Error(
					"A second question in the same session displayed a download status",
				);
			}

			const qwenBeforeRefresh = qwenRequests().length;
			await page.reload({ waitUntil: "networkidle", timeout: 120_000 });
			await openDrawer();
			const refreshedAnswer = await askGrounded(
				"Which work uses local AI for medical claim review?",
			);
			refreshedGeneration = await generateExplanation(refreshedAnswer);
			if (qwenRequests().length !== qwenBeforeRefresh) {
				throw new Error("Refreshing the page redownloaded Qwen");
			}
			if (
				!refreshedGeneration.statuses.includes("Loading local AI model…") ||
				refreshedGeneration.statuses.some((status) =>
					status.startsWith("Downloading local AI model"),
				)
			) {
				throw new Error(
					"A refreshed page did not identify the model as loading from cache",
				);
			}
		}

		const navigationGenerations = [];
		let reopenedGeneration = null;
		if (!cacheLifecycleOnly) {
			const navigationQuestions = [
				"Which project involves autonomous agent orchestration?",
				"Which work uses local AI for medical claim review?",
				"Which projects emphasize privacy-preserving local inference?",
			];
			for (const [index, question] of navigationQuestions.entries()) {
				await closeDrawer();
				await navigateWithSwup("/projects/posts/medclaim-sentinel/");
				await navigateWithSwup("/projects/");
				if ((await localLlmWorkerCount()) !== index + 1) {
					throw new Error(
						"Swup navigation recreated the local-LLM worker before an explicit Generate click",
					);
				}
				await openDrawer();
				const answer = await askGrounded(question);
				const controls = answer.locator(".project-intelligence-local-ai");
				const staleStatus = (
					(await controls
						.locator(".project-intelligence-local-ai-status")
						.textContent()) || ""
				).trim();
				if (
					staleStatus !==
					"Local AI will reinitialize from cache when requested."
				) {
					throw new Error(`Missing stale-worker status: ${staleStatus}`);
				}
				const qwenBeforeRecreation = qwenRequests().length;
				const generation = await generateExplanation(answer);
				if ((await localLlmWorkerCount()) !== index + 2) {
					throw new Error(
						"Explicit Generate did not create exactly one fresh worker",
					);
				}
				if (qwenRequests().length !== qwenBeforeRecreation) {
					throw new Error(
						"Worker recreation redownloaded Qwen instead of using cache",
					);
				}
				navigationGenerations.push({ staleStatus, generation });
			}

			await closeDrawer();
			const workerCountBeforeReopen = await localLlmWorkerCount();
			await openDrawer();
			const reopenedAnswer = await askGrounded(
				"Which project uses evidence-grounded review workflows?",
			);
			reopenedGeneration = await generateExplanation(reopenedAnswer);
			if ((await localLlmWorkerCount()) !== workerCountBeforeReopen) {
				throw new Error(
					"Closing and reopening the drawer replaced a healthy worker",
				);
			}
			if (qwenRequests().length !== qwenAfterFirstGeneration) {
				throw new Error(
					"A cached navigation/reopen generation redownloaded Qwen",
				);
			}
		}

		const forbiddenLifecycleErrors = consoleErrors.filter((message) =>
			/valid external Instance reference no longer exists|GPUBuffer[^\n]*mapAsync|first-token-timeout|Uncaught \(in promise\).*AbortError/i.test(
				message,
			),
		);
		if (forbiddenLifecycleErrors.length) {
			throw new Error(
				`WebGPU lifecycle errors remained: ${JSON.stringify(forbiddenLifecycleErrors)}`,
			);
		}

		const externalInferenceRequests = requests.filter((request) =>
			/openai|anthropic|generativelanguage|api\.gemini|\/ask(?:\?|$)/i.test(
				request.url,
			),
		);
		if (externalInferenceRequests.length) {
			throw new Error(
				`External inference request detected: ${JSON.stringify(externalInferenceRequests)}`,
			);
		}

		console.log(
			JSON.stringify(
				{
					status: "passed",
					reusedProfile,
					cacheLifecycleOnly,
					capabilities,
					qwenRequests: qwenRequests().length,
					localLlmWorkerCreations: await localLlmWorkerCount(),
					localModelDiagnostic,
					localCacheDiagnostic,
					browserCache: firstCacheReport,
					firstGeneration,
					sameSessionGeneration,
					refreshedGeneration,
					navigationGenerations,
					reopenedGeneration,
					consoleMessages,
					consoleErrors,
				},
				null,
				2,
			),
		);
	}
} catch (error) {
	const localAiDiagnostics = consoleMessages.filter(
		(message) =>
			message.includes("[Project Intelligence Local AI]") ||
			message.includes("Unable to determine content-length"),
	);
	console.error(
		JSON.stringify(
			{
				status: "failed",
				errorName: error instanceof Error ? error.name : "Error",
				errorMessage:
					error instanceof Error ? error.message : "Local AI QA failed",
				localAiDiagnostics,
				consoleErrors: consoleErrors.filter((message) =>
					message.includes("[Project Intelligence Local AI]"),
				),
			},
			null,
			2,
		),
	);
	throw error;
} finally {
	await context.close();
}
