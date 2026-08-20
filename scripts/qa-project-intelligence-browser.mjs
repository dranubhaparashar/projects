import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const baseUrl =
	process.argv[2] || "http://127.0.0.1:4321/projects/?view=projects";
const profile =
	process.argv[3] || join(tmpdir(), `project-intelligence-qa-${Date.now()}`);
const externalWrites = [];
const consoleErrors = [];
const requests = [];

const context = await chromium.launchPersistentContext(profile, {
	headless: true,
	viewport: { width: 1440, height: 1000 },
	args: [
		"--enable-unsafe-webgpu",
		"--enable-features=WebGPU",
		"--use-angle=swiftshader",
	],
});

function observe(page) {
	page.on("request", (request) => {
		const url = request.url();
		requests.push({
			method: request.method(),
			url,
			postData: request.postData() || "",
		});
		if (
			!/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(url) &&
			!["GET", "HEAD", "OPTIONS"].includes(request.method())
		) {
			externalWrites.push({ method: request.method(), url });
		}
	});
	page.on("console", (message) => {
		if (message.type() === "error") consoleErrors.push(message.text());
	});
	page.on("pageerror", (error) => consoleErrors.push(error.message));
}

async function openDrawer(page) {
	await page.getByRole("button", { name: "Ask about my work" }).click();
	await page
		.locator("[data-project-intelligence-dialog]")
		.waitFor({ state: "visible" });
	const layerIsPortaled = await page.evaluate(
		() =>
			document.querySelector("[data-project-intelligence-layer]")
				?.parentElement === document.body,
	);
	if (!layerIsPortaled) {
		throw new Error(
			"Project Intelligence layer is not portaled to document.body",
		);
	}
}

async function openAssistant(page) {
	await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 120_000 });
	await openDrawer(page);
}

async function closeDrawer(page) {
	await page
		.getByRole("button", { name: "Close Project Intelligence" })
		.last()
		.click();
	await page
		.locator("[data-project-intelligence-layer]")
		.waitFor({ state: "hidden" });
}

async function waitForSwupReady(page) {
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

async function ask(page, question, timeout = 900_000, submitWithEnter = false) {
	const input = page.locator("[data-project-intelligence-input]");
	const form = page.locator("[data-project-intelligence-form]");
	const started = performance.now();
	await input.fill(question);
	const loadingStarted = page.waitForFunction(
		() =>
			document
				.querySelector("[data-project-intelligence-form]")
				?.getAttribute("aria-busy") === "true",
		undefined,
		{ timeout: 10_000 },
	);
	if (submitWithEnter) {
		await input.press("Enter");
	} else {
		await form
			.getByRole("button", { name: "Ask Project Intelligence" })
			.click();
	}
	await loadingStarted;
	let retrievalMs = null;
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		const modes = await page
			.locator(".project-intelligence-mode-note")
			.allTextContents();
		if (
			retrievalMs === null &&
			modes.some((mode) => /browser-local (?:rag|ai)/i.test(mode))
		) {
			retrievalMs = performance.now() - started;
		}
		if ((await form.getAttribute("aria-busy")) !== "true") break;
		await page.waitForTimeout(200);
	}
	if ((await form.getAttribute("aria-busy")) === "true") {
		throw new Error(`Question timed out: ${question}`);
	}
	const totalMs = performance.now() - started;
	const assistant = page
		.locator(".project-intelligence-message.is-assistant:not(.is-loading)")
		.last();
	const mode =
		(
			await assistant.locator(".project-intelligence-mode-note").textContent()
		)?.trim() || "";
	const answer =
		(
			await assistant.locator(".project-intelligence-answer-lead").textContent()
		)?.trim() || "";
	const sources = await assistant
		.locator(".project-intelligence-sources a")
		.evaluateAll((links) =>
			links.map((link) => ({
				text: link.textContent?.trim() || "",
				href: link.getAttribute("href") || "",
			})),
		);
	const related = await assistant
		.locator(".project-intelligence-related a")
		.evaluateAll((links) =>
			links.map((link) => ({
				text: link.textContent?.trim() || "",
				href: link.getAttribute("href") || "",
			})),
		);
	const detail =
		(
			await assistant
				.locator(".project-intelligence-ai-detail")
				.textContent()
				.catch(() => "")
		)?.trim() || "";
	return {
		question,
		mode,
		answer,
		sources,
		related,
		detail,
		retrievalMs,
		totalMs,
	};
}

async function messageCounts(page) {
	return page.evaluate(() => ({
		browserRag: [
			...document.querySelectorAll(".project-intelligence-mode-note"),
		].filter((node) => node.textContent?.includes("Browser-local RAG")).length,
		user: document.querySelectorAll(".project-intelligence-message.is-user")
			.length,
	}));
}

async function clickSuggestedQuestion(page, question, timeout = 300_000) {
	const before = await messageCounts(page);
	const loadingStarted = page.waitForFunction(
		() =>
			document
				.querySelector("[data-project-intelligence-form]")
				?.getAttribute("aria-busy") === "true",
		undefined,
		{ timeout: 10_000 },
	);
	await page.getByRole("button", { name: question, exact: true }).click();
	await loadingStarted;
	await page.waitForFunction(
		({ expectedCount, expectedQuestion }) => {
			const messages = [
				...document.querySelectorAll(".project-intelligence-message.is-user"),
			];
			return (
				messages.length === expectedCount &&
				messages.at(-1)?.textContent?.trim() === expectedQuestion
			);
		},
		{ expectedCount: before.user + 1, expectedQuestion: question },
		{ timeout: 10_000 },
	);
	await page.waitForFunction(
		(expectedCount) =>
			[...document.querySelectorAll(".project-intelligence-mode-note")].filter(
				(node) => node.textContent?.includes("Browser-local RAG"),
			).length === expectedCount,
		before.browserRag + 1,
		{ timeout },
	);
	await page.waitForFunction(
		() =>
			document
				.querySelector("[data-project-intelligence-form]")
				?.getAttribute("aria-busy") !== "true",
		undefined,
		{ timeout: 10_000 },
	);
	const after = await messageCounts(page);
	if (after.user !== before.user + 1) {
		throw new Error(`Suggestion produced duplicate user messages: ${question}`);
	}
	if (after.browserRag !== before.browserRag + 1) {
		throw new Error(`Suggestion produced duplicate RAG answers: ${question}`);
	}
	return { question, before, after };
}

async function verifyPortaledLink(page, selector, label) {
	const link = page.locator(selector).last();
	if ((await link.count()) === 0) {
		throw new Error(
			`No ${label} link was rendered in a Browser-local RAG answer`,
		);
	}
	const href = await link.getAttribute("href");
	if (!href) throw new Error(`${label} link has no href`);
	await link.evaluate((node) => {
		node.addEventListener(
			"click",
			(event) => {
				event.preventDefault();
				node.setAttribute("data-portal-qa-clicked", "true");
			},
			{ once: true },
		);
	});
	await link.click();
	if ((await link.getAttribute("data-portal-qa-clicked")) !== "true") {
		throw new Error(`${label} link did not receive the portaled click`);
	}
	return href;
}

function assertIncludes(result, expected) {
	const corpus = JSON.stringify(result).toLowerCase();
	for (const value of expected) {
		if (!corpus.includes(value.toLowerCase())) {
			throw new Error(`Expected ${value} for question: ${result.question}`);
		}
	}
}

async function vectorScanBenchmark(page) {
	return page.evaluate(async () => {
		const metadata = await fetch(
			"/projects/project-intelligence/project-vector-metadata.json",
		).then((response) => response.json());
		const vectors = new Float32Array(
			await fetch("/projects/project-intelligence/project-vectors.bin").then(
				(response) => response.arrayBuffer(),
			),
		);
		const query = new Float32Array(metadata.dimensions);
		query[0] = 1;
		const started = performance.now();
		let maximum = Number.NEGATIVE_INFINITY;
		for (let row = 0; row < metadata.count; row += 1) {
			let score = 0;
			const offset = row * metadata.dimensions;
			for (let column = 0; column < metadata.dimensions; column += 1) {
				score += query[column] * vectors[offset + column];
			}
			maximum = Math.max(maximum, score);
		}
		return {
			milliseconds: performance.now() - started,
			count: metadata.count,
			dimensions: metadata.dimensions,
			maximum,
		};
	});
}

const enabledPage = context.pages()[0] || (await context.newPage());
observe(enabledPage);
await enabledPage.goto(baseUrl, { waitUntil: "networkidle", timeout: 120_000 });
const initialModelRequests = requests.filter((request) =>
	/huggingface|onnx|project-vectors|ort-wasm/i.test(request.url),
);
await enabledPage
	.getByRole("button", { name: "Ask about my work" })
	.click();
await enabledPage
	.locator("[data-project-intelligence-dialog]")
	.waitFor({ state: "visible" });
await enabledPage.waitForTimeout(750);
const openOnlyModelRequests = requests.filter((request) =>
	/huggingface|onnx|project-vectors|ort-wasm/i.test(request.url),
);
const webGpu = await enabledPage.evaluate(async () => {
	const gpu = navigator.gpu;
	if (!gpu) return { available: false, features: [] };
	const adapter = await gpu.requestAdapter();
	return {
		available: Boolean(adapter),
		features: adapter ? [...adapter.features] : [],
	};
});
const qwenRequestsBeforeQuestion = requests.filter((request) =>
	/Qwen2\.5-0\.5B-Instruct/i.test(request.url),
).length;
const cold = await ask(
	enabledPage,
	"Which work deals with privacy-preserving credentials?",
);
assertIncludes(cold, ["LightDID-ZKP"]);
const qwenRequestsAfterGroundedAnswer = requests.filter((request) =>
	/Qwen2\.5-0\.5B-Instruct/i.test(request.url),
).length;
if (qwenRequestsAfterGroundedAnswer !== qwenRequestsBeforeQuestion) {
	throw new Error(
		"Qwen downloaded before the visitor requested an explanation",
	);
}
if (
	(await enabledPage
		.getByText("Loading local AI model for the first answer", { exact: false })
		.count()) > 0
) {
	throw new Error("The obsolete first-answer local-model loader was rendered");
}
const deeperExplanationButtonVisible = await enabledPage
	.getByRole("button", { name: "Generate deeper local AI explanation" })
	.isVisible()
	.catch(() => false);
if (
	webGpu.available &&
	webGpu.features.includes("shader-f16") &&
	!deeperExplanationButtonVisible
) {
	throw new Error("The optional local-AI explanation button was not rendered");
}
if (
	deeperExplanationButtonVisible &&
	(await enabledPage
		.getByText("Local model: Qwen2.5-0.5B-Instruct · q4 · WebGPU", {
			exact: true,
		})
		.count()) === 0
) {
	throw new Error("The local-AI dtype/device diagnostic was not rendered");
}

await context.addInitScript(() => {
	Object.defineProperty(navigator, "gpu", {
		configurable: true,
		value: undefined,
	});
});

const expectedSuggestions = [
	"Which projects use computer vision?",
	"Have you deployed models in production?",
	"Show projects related to healthcare.",
	"Which projects use Snowflake?",
	"Which project is most relevant to logistics?",
	"Show projects involving Generative AI.",
	"Which projects have live demos?",
	"Which projects use multimodal AI?",
];
const portalPage = await context.newPage();
observe(portalPage);
await openAssistant(portalPage);
const renderedSuggestions = await portalPage
	.locator("[data-project-intelligence-suggestion]")
	.allTextContents();
const normalizedSuggestions = renderedSuggestions.map((question) =>
	question.trim(),
);
if (
	JSON.stringify(normalizedSuggestions) !== JSON.stringify(expectedSuggestions)
) {
	throw new Error(
		`Unexpected suggested questions: ${JSON.stringify(normalizedSuggestions)}`,
	);
}

const portalSuggestionResults = [];
portalSuggestionResults.push(
	await clickSuggestedQuestion(
		portalPage,
		"Which projects use computer vision?",
	),
);
await closeDrawer(portalPage);
await openDrawer(portalPage);
portalSuggestionResults.push(
	await clickSuggestedQuestion(portalPage, "Which projects use Snowflake?"),
);

await closeDrawer(portalPage);
await portalPage.getByRole("link", { name: "Archive" }).first().click();
await portalPage.waitForURL(/\/archive\//, { timeout: 30_000 });
await portalPage
	.getByRole("link", { name: /Anubha Parashar/i })
	.first()
	.click();
await portalPage.waitForURL((url) => url.pathname.endsWith("/projects/"), {
	timeout: 30_000,
});
await waitForSwupReady(portalPage);
await openDrawer(portalPage);
portalSuggestionResults.push(
	await clickSuggestedQuestion(
		portalPage,
		"Show projects related to healthcare.",
	),
);

await closeDrawer(portalPage);
await openDrawer(portalPage);
const manualHealthcareBefore = await messageCounts(portalPage);
const manualHealthcare = await ask(
	portalPage,
	"Show projects related to healthcare.",
	300_000,
);
const manualHealthcareAfter = await messageCounts(portalPage);
if (!/browser-local rag/i.test(manualHealthcare.mode)) {
	throw new Error("Manual healthcare submission did not use Browser-local RAG");
}
if (manualHealthcareAfter.user !== manualHealthcareBefore.user + 1) {
	throw new Error(
		"Manual healthcare submission produced duplicate user messages",
	);
}
if (
	manualHealthcareAfter.browserRag !==
	manualHealthcareBefore.browserRag + 1
) {
	throw new Error(
		"Manual healthcare submission produced duplicate RAG answers",
	);
}

const manualEnterBefore = await messageCounts(portalPage);
const manualEnter = await ask(
	portalPage,
	"Which projects use Snowflake?",
	300_000,
	true,
);
const manualEnterAfter = await messageCounts(portalPage);
if (!/browser-local rag/i.test(manualEnter.mode)) {
	throw new Error("Enter-key form submission did not use Browser-local RAG");
}
if (manualEnterAfter.user !== manualEnterBefore.user + 1) {
	throw new Error("Enter-key form submission produced duplicate user messages");
}
if (manualEnterAfter.browserRag !== manualEnterBefore.browserRag + 1) {
	throw new Error("Enter-key form submission produced duplicate RAG answers");
}

for (const question of expectedSuggestions.filter(
	(question) =>
		![
			"Which projects use computer vision?",
			"Which projects use Snowflake?",
			"Show projects related to healthcare.",
		].includes(question),
)) {
	await closeDrawer(portalPage);
	await openDrawer(portalPage);
	portalSuggestionResults.push(
		await clickSuggestedQuestion(portalPage, question),
	);
}
const sourceHref = await verifyPortaledLink(
	portalPage,
	".project-intelligence-sources a",
	"source",
);
const relatedHref = await verifyPortaledLink(
	portalPage,
	".project-intelligence-related a",
	"related-project",
);
const portalRegression = {
	layerParentIsBody: await portalPage.evaluate(
		() =>
			document.querySelector("[data-project-intelligence-layer]")
				?.parentElement === document.body,
	),
	manualHealthcare: {
		before: manualHealthcareBefore,
		after: manualHealthcareAfter,
		mode: manualHealthcare.mode,
	},
	manualEnter: {
		before: manualEnterBefore,
		after: manualEnterAfter,
		mode: manualEnter.mode,
	},
	relatedHref,
	sourceHref,
	suggestions: portalSuggestionResults,
};
await portalPage.close();

const fallbackPage = await context.newPage();
observe(fallbackPage);
await openAssistant(fallbackPage);
const cases = [
	[
		"Which projects deal with predictive industrial failures?",
		["Predictive & Preventive Maintenance"],
	],
	[
		"Which project involves autonomous agent orchestration?",
		["MCP 2.0", "Autonomous Microservice Composition"],
	],
	["Which work relates to vehicle perception?", ["Vehicle-Scale LLMs"]],
	["Which projects use Snowflake?", ["Snowflake"]],
	["Which projects use YOLO?", ["YOLO"]],
	["Do you use MCP?", ["MCP"]],
	["Which project uses BBS+?", ["LightDID-ZKP"]],
	[
		"Compare MCP 2.0 and Autonomous Microservice Composition",
		["MCP 2.0", "Autonomous Microservice Composition"],
	],
];
const retrievalResults = [];
for (const [question, expected] of cases) {
	const result = await ask(fallbackPage, question, 300_000);
	assertIncludes(result, expected);
	if (!/browser-local rag/i.test(result.mode)) {
		throw new Error(`Expected browser-local RAG mode for: ${question}`);
	}
	retrievalResults.push(result);
}

const hallucinationQuestions = [
	"Which project generated $10 million?",
	"What H100 cluster did you use?",
	"Which project was deployed at Google?",
];
const hallucinationResults = [];
for (const question of hallucinationQuestions) {
	const result = await ask(fallbackPage, question, 60_000);
	if (
		result.answer !==
		"The published portfolio does not provide enough information to confirm that."
	) {
		throw new Error(`Unsupported claim was not refused: ${question}`);
	}
	hallucinationResults.push(result);
}

await fallbackPage.setViewportSize({ width: 390, height: 844 });
const mobile = await ask(fallbackPage, "Which project uses BBS+?", 300_000);
assertIncludes(mobile, ["LightDID-ZKP"]);
const vectorBenchmark = await vectorScanBenchmark(fallbackPage);

for (const result of [
	cold,
	...retrievalResults,
	...hallucinationResults,
	mobile,
]) {
	for (const source of result.sources) {
		if (!source.href.startsWith("/projects/posts/")) {
			throw new Error(`Untrusted source URL rendered: ${source.href}`);
		}
	}
}
const askedQuestions = [
	cold.question,
	...retrievalResults.map((result) => result.question),
	...hallucinationResults.map((result) => result.question),
	mobile.question,
];
const questionLeaks = requests.filter(
	(request) =>
		!request.url.startsWith(baseUrl) &&
		askedQuestions.some(
			(question) =>
				question.length >= 12 &&
				request.postData.toLowerCase().includes(question.toLowerCase()),
		),
);
const externalInferenceRequests = requests.filter((request) =>
	/openai|anthropic|generativelanguage|api\.gemini|\/ask(?:\?|$)/i.test(
		request.url,
	),
);
if (questionLeaks.length) {
	throw new Error(
		`Question data left the browser: ${JSON.stringify(questionLeaks)}`,
	);
}
if (externalInferenceRequests.length) {
	throw new Error(
		`External inference request detected: ${JSON.stringify(externalInferenceRequests)}`,
	);
}

const report = {
	baseUrl,
	profile,
	webGpu,
	initialModelRequestCount: initialModelRequests.length,
	openOnlyModelRequestCount: openOnlyModelRequests.length,
	qwenRequestsBeforeQuestion,
	qwenRequestsAfterGroundedAnswer,
	deeperExplanationButtonVisible,
	portalRegression,
	cold,
	warm: retrievalResults[0],
	retrievalResults,
	hallucinationResults,
	mobile,
	vectorBenchmark,
	externalWrites,
	questionLeaks,
	externalInferenceRequests,
	modelHosts: [
		...new Set(
			requests
				.filter((request) => !request.url.startsWith(baseUrl))
				.map((request) => new URL(request.url).host),
		),
	],
	consoleErrors,
};
console.log(JSON.stringify(report, null, 2));
await context.close();
