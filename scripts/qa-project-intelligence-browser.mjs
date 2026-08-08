import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const baseUrl = process.argv[2] || "http://127.0.0.1:4321/projects/";
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
		requests.push({ method: request.method(), url });
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

async function openAssistant(page) {
	await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 120_000 });
	await page.getByRole("button", { name: "Ask about my projects" }).click();
	await page
		.locator("[data-project-intelligence-dialog]")
		.waitFor({ state: "visible" });
}

async function ask(page, question, timeout = 900_000) {
	const input = page.locator("[data-project-intelligence-input]");
	const form = page.locator("[data-project-intelligence-form]");
	const started = performance.now();
	await input.fill(question);
	await form.getByRole("button", { name: "Ask Project Intelligence" }).click();
	await page.waitForFunction(
		() =>
			document
				.querySelector("[data-project-intelligence-form]")
				?.getAttribute("aria-busy") === "true",
		undefined,
		{ timeout: 10_000 },
	);
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
		let maximum = -Infinity;
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
	.getByRole("button", { name: "Ask about my projects" })
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
const cold = await ask(
	enabledPage,
	"Which work deals with privacy-preserving credentials?",
);
assertIncludes(cold, ["LightDID-ZKP"]);

await context.addInitScript(() => {
	Object.defineProperty(navigator, "gpu", {
		configurable: true,
		value: undefined,
	});
});
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
if (externalWrites.length)
	throw new Error(
		`External write requests detected: ${JSON.stringify(externalWrites)}`,
	);

const report = {
	baseUrl,
	profile,
	webGpu,
	initialModelRequestCount: initialModelRequests.length,
	openOnlyModelRequestCount: openOnlyModelRequests.length,
	cold,
	warm: retrievalResults[0],
	retrievalResults,
	hallucinationResults,
	mobile,
	vectorBenchmark,
	externalWrites,
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
