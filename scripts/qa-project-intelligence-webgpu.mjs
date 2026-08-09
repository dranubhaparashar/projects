import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const baseUrl = process.argv[2] || "http://127.0.0.1:4321/projects/";
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
		"--no-first-run",
		"--window-position=-32000,-32000",
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

function qwenRequests() {
	return requests.filter((request) =>
		/Qwen2\.5-0\.5B-Instruct/i.test(request.url),
	);
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
		(expected) =>
			[...document.querySelectorAll(".project-intelligence-mode-note")].filter(
				(node) => node.textContent?.includes("Browser-local RAG"),
			).length > expected,
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
	return page
		.locator(".project-intelligence-message.is-assistant")
		.filter({ has: page.getByText("Browser-local RAG", { exact: true }) })
		.last();
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
		await page.getByRole("button", { name: "Ask about my projects" }).click();
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
				.textContent()) || ""
		).trim();
		if (
			localModelDiagnostic !==
			"Local model: Qwen2.5-0.5B-Instruct · q4 · WebGPU"
		) {
			throw new Error(
				`Unexpected local-model diagnostic: ${localModelDiagnostic}`,
			);
		}

		const firstGeneration = await generateExplanation(firstAnswer);
		const qwenAfterFirstGeneration = qwenRequests().length;
		if (qwenAfterFirstGeneration <= qwenAfterFirstAnswer) {
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
			"Initializing WebGPU…",
			"Local AI ready",
			"Generating explanation…",
		]) {
			if (!firstGeneration.statuses.includes(expectedStatus)) {
				throw new Error(`Missing local-AI progress state: ${expectedStatus}`);
			}
		}
		const showedRealPercentage = firstGeneration.statuses.some((status) =>
			/^Downloading local AI model — \d+%$/.test(status),
		);
		const showedUnknownTotalBytes =
			firstGeneration.statuses.includes("Downloading local AI model…") &&
			firstGeneration.downloadDetails.some((detail) =>
				/^Downloaded [\d,.]+ MB$/.test(detail),
			);
		if (!showedRealPercentage && !showedUnknownTotalBytes) {
			throw new Error(
				"No honest Transformers.js download percentage or byte count was shown",
			);
		}

		const secondAnswer = await askGrounded(
			"Which project involves autonomous agent orchestration?",
		);
		if (qwenRequests().length !== qwenAfterFirstGeneration) {
			throw new Error("The second RAG question triggered a Qwen request");
		}
		const secondGeneration = await generateExplanation(secondAnswer);
		const qwenAfterSecondGeneration = qwenRequests().length;
		if (qwenAfterSecondGeneration !== qwenAfterFirstGeneration) {
			throw new Error("The second explanation downloaded Qwen again");
		}

		const workerUrls = await page.evaluate(
			() => window.__projectIntelligenceWorkerUrls || [],
		);
		const localLlmWorkerUrls = workerUrls.filter((url) =>
			/browser-llm\.worker/i.test(url),
		);
		if (localLlmWorkerUrls.length !== 1) {
			throw new Error(
				`Expected one local-LLM worker, found ${localLlmWorkerUrls.length}`,
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
					capabilities,
					qwenRequests: qwenAfterFirstGeneration,
					localLlmWorkerCreations: localLlmWorkerUrls.length,
					localModelDiagnostic,
					firstGeneration,
					secondGeneration,
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
