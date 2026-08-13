import type { CollectionEntry } from "astro:content";
import { existsSync } from "node:fs";
import path from "node:path";
import { generateProjectCardCover } from "./project-card-cover";
import { getProjectDomainPresentation } from "./project-impact-data";
import { getDocumentedProjectMaturity } from "./project-view-data";
import { getDir } from "./url-utils";

type TextOrList = string | string[];
type CapabilityGroup =
	| "business"
	| "method"
	| "platform"
	| "deployment"
	| "other";

export type ProjectCardStatusType =
	| "production"
	| "pilot"
	| "operational"
	| "prototype"
	| "research"
	| "concept";

export interface ProjectCardAction {
	label: string;
	url: string;
	kind: "demo" | "github" | "video" | "pdf";
	external: boolean;
}

export interface ProjectCardEvidence {
	label: string;
	url: string;
	external: boolean;
	direct: boolean;
}

export interface ProjectCardImage {
	src: string;
	darkSrc?: string;
	alt: string;
	basePath: string;
	fit: "cover" | "contain";
	architecture?: boolean;
	generated?: boolean;
}

export interface ProjectCardData {
	fullTitle: string;
	displayTitle: string;
	hasDisplayTitle: boolean;
	summary: string;
	problem: string;
	solution: string;
	capabilities: string[];
	additionalCapabilityCount: number;
	status?: { label: string; type: ProjectCardStatusType };
	image: ProjectCardImage;
	evidence: ProjectCardEvidence[];
	additionalEvidenceCount: number;
	actions: ProjectCardAction[];
	featuredEvidence?: ProjectCardEvidence;
	maturitySummary: string[];
	whyItMatters: string;
	quickActions: Array<{
		label: "Architecture" | "Live Demo";
		url: string;
		external: boolean;
	}>;
}

type LinkCandidate = { label: string; url: string };
type CapabilityCandidate = {
	label: string;
	key: string;
	group: CapabilityGroup;
	score: number;
};

const GENERIC_CAPABILITIES = new Set([
	"ai",
	"application",
	"demo",
	"example",
	"machine learning",
	"ml",
	"project",
	"python",
]);

const CAPABILITY_RULES: Array<{
	group: CapabilityGroup;
	weight: number;
	terms: string[];
}> = [
	{
		group: "business",
		weight: 38,
		terms: [
			"analytics",
			"automation",
			"claim",
			"clinical",
			"decision support",
			"detection",
			"document intelligence",
			"evidence",
			"financial",
			"fraud",
			"identity",
			"insurance",
			"logistics",
			"maintenance",
			"monitoring",
			"optimization",
			"reconciliation",
			"risk",
			"security",
			"telecom",
			"workflow",
		],
	},
	{
		group: "method",
		weight: 34,
		terms: [
			"agent",
			"computer vision",
			"generative",
			"int4",
			"llm",
			"multimodal",
			"ocr",
			"quantization",
			"rag",
			"solver",
			"vision",
			"yolo",
			"zero knowledge",
			"zkp",
		],
	},
	{
		group: "platform",
		weight: 30,
		terms: [
			"azure",
			"docker",
			"fastapi",
			"gemini",
			"hugging face",
			"ollama",
			"opencv",
			"or-tools",
			"plotly",
			"postgres",
			"pyvrp",
			"qwen",
			"redis",
			"snowflake",
			"sqlite",
			"streamlit",
		],
	},
	{
		group: "deployment",
		weight: 32,
		terms: [
			"ci/cd",
			"cloud",
			"container",
			"devops",
			"devsecops",
			"edge",
			"mlops",
			"production",
		],
	},
];

const PROBLEM_HEADINGS = [
	/^business problem$/i,
	/^problem statement$/i,
	/^the problem$/i,
	/^what problem is (it|this) solving\??$/i,
	/^why (this|the) project exists$/i,
	/^challenge$/i,
];

const SOLUTION_HEADINGS = [
	/^proposed solution$/i,
	/^the solution$/i,
	/^solution$/i,
	/^what (i|we) built$/i,
	/^one[- ]line idea$/i,
	/^approach$/i,
];

const EVIDENCE_ORDER = [
	"Demo",
	"Architecture",
	"Paper",
	"Video",
	"Dataset",
	"Metrics",
	"GitHub",
	"PDF",
	"Dashboard",
];

/** View analytics stay secondary until a count carries meaningful signal. */
export const PROJECT_VIEW_COUNT_THRESHOLD = 25;

const ARCHITECTURE_PREVIEW_PATTERN =
	/\b(?:architecture|architectural|diagram|flowchart|system design|solution design)\b/i;
const NON_ARCHITECTURE_PREVIEW_PATTERN =
	/\b(?:cover|dashboard|interface|photo|photograph|screen(?:shot)?|ui)\b/i;

const COMPACT_STATUS_LABELS: Record<ProjectCardStatusType, string> = {
	production: "Live / Deployed",
	pilot: "Pilot",
	operational: "Operational",
	prototype: "Prototype",
	research: "Research",
	concept: "Concept",
};

function normalize(value: string): string {
	return String(value || "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim()
		.toLowerCase();
}

function comparisonKey(value: string): string {
	return normalize(value)
		.replace(/[^a-z0-9]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

const DISPLAY_TITLE_ALIASES: Array<{ pattern: RegExp; title: string }> = [
	{ pattern: /^DACR-Q\b/i, title: "DACR-Q" },
	{ pattern: /^Vehicle-Scale LLMs\b/i, title: "Vehicle-Scale LLMs" },
	{
		pattern: /^Autonomous Microservice Composition\b/i,
		title: "Autonomous Microservice Composition",
	},
	{ pattern: /^MCP 2\.0\b/i, title: "MCP 2.0" },
];

function compactDisplayTitle(value: string): string {
	const explicitAlias = DISPLAY_TITLE_ALIASES.find(({ pattern }) =>
		pattern.test(value.trim()),
	)?.title;
	if (explicitAlias) return explicitAlias;
	let compact = value
		.replace(/\bProfit and Loss\b/gi, "P&L")
		.replace(/\bArtificial Intelligence\b/gi, "AI")
		.replace(/\bLarge Language Models?\b/gi, "LLMs")
		.trim();
	const aiPowered = compact.match(/^AI[- ]Powered\s+(.+)$/i)?.[1]?.trim();
	if (aiPowered) compact = `${aiPowered} AI`;
	return compact;
}

function uniqueValues(values: string[]): string[] {
	const seen = new Set<string>();
	return values.filter((value) => {
		const key = normalize(value);
		if (!key || seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function stripMarkdown(value: string): string {
	return String(value || "")
		.replace(/<!--[\s\S]*?-->/g, " ")
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/::[\w-]+(?:\{[^}]*\})?/g, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/^>\s?/gm, "")
		.replace(/^[-*+]\s+/gm, "")
		.replace(/^\d+\.\s+/gm, "")
		.replace(/[*_`~]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function firstSentence(value: string): string {
	const clean = stripMarkdown(value);
	if (!clean) return "";
	return clean.match(/^.*?[.!?](?=\s|$)/)?.[0]?.trim() || clean;
}

function textValue(value?: TextOrList): string {
	if (Array.isArray(value))
		return firstSentence(value.find((item) => stripMarkdown(item)) || "");
	return firstSentence(value || "");
}

function extractHeadingSection(body: string, headings: RegExp[]): string {
	const lines = String(body || "").split(/\r?\n/);
	for (let index = 0; index < lines.length; index += 1) {
		const match = lines[index].match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
		if (!match || !headings.some((rule) => rule.test(stripMarkdown(match[2]))))
			continue;
		const level = match[1].length;
		const section: string[] = [];
		for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
			const next = lines[cursor].match(/^(#{1,6})\s+/);
			if (next && next[1].length <= level) break;
			section.push(lines[cursor]);
		}
		for (const paragraph of section.join("\n").split(/\n\s*\n/)) {
			const candidate = paragraph.trim();
			if (!candidate || /^(?:!\[|\||:::|```|[-*+]\s|\d+\.\s)/.test(candidate))
				continue;
			const value = firstSentence(candidate);
			if (value && !value.endsWith(":")) return value;
		}
	}
	return "";
}

function extractTableValue(body: string, keys: string[]): string {
	const wanted = new Set(keys.map(normalize));
	for (const line of String(body || "").split(/\r?\n/)) {
		const cells = line.split("|").map(stripMarkdown).filter(Boolean);
		if (cells.length >= 2 && wanted.has(normalize(cells[0]))) {
			return firstSentence(cells.slice(1).join(" "));
		}
	}
	return "";
}

function getProblem(entry: CollectionEntry<"posts">): string {
	return (
		firstSentence(entry.data.card?.problem || "") ||
		textValue(entry.data.views?.executive?.business_problem) ||
		extractHeadingSection(entry.body || "", PROBLEM_HEADINGS) ||
		extractTableValue(entry.body || "", [
			"problem statement",
			"problem-statement",
			"business problem",
		])
	);
}

function getSolution(entry: CollectionEntry<"posts">): string {
	return (
		firstSentence(entry.data.card?.solution || "") ||
		textValue(
			entry.data.views?.executive?.proposed_solution ||
				entry.data.views?.executive?.solution,
		) ||
		extractHeadingSection(entry.body || "", SOLUTION_HEADINGS) ||
		extractTableValue(entry.body || "", [
			"proposed solution",
			"proposed-solution",
			"primary objective",
			"primary-objective",
			"solution",
		])
	);
}

function compactSentence(value: string, maxLength = 220): string {
	const sentence = firstSentence(value);
	if (sentence.length <= maxLength) return sentence;
	const shortened = sentence.slice(0, maxLength + 1).replace(/\s+\S*$/, "");
	return `${shortened || sentence.slice(0, maxLength).trim()}â€¦`;
}

function getWhyItMatters(
	entry: CollectionEntry<"posts">,
	problem: string,
): string {
	const outcome = entry.data.views?.executive?.outcome;
	const outcomeSummary =
		outcome && !Array.isArray(outcome) && typeof outcome === "object"
			? textValue(outcome.summary)
			: textValue(outcome);
	const description = firstSentence(entry.data.description || "");
	const descriptionHasValueLanguage =
		/\b(helps?|supports?|enables?|reduces?|detects?|identifies?|forecasts?|prevents?|improves?|prioriti[sz]es?|validates?)\b/i.test(
			description,
		);
	const candidate =
		textValue(entry.data.views?.executive?.cost_risk_reduction) ||
		outcomeSummary ||
		problem ||
		(descriptionHasValueLanguage ? description : "");
	const compact = compactSentence(candidate);
	return compact.length >= 32 ? compact : "";
}

function classifyCapability(value: string): {
	group: CapabilityGroup;
	weight: number;
} {
	const key = normalize(value);
	let selected: { group: CapabilityGroup; weight: number } = {
		group: "other",
		weight: 0,
	};
	for (const rule of CAPABILITY_RULES) {
		if (
			rule.weight > selected.weight &&
			rule.terms.some((term) => key.includes(term))
		) {
			selected = { group: rule.group, weight: rule.weight };
		}
	}
	return selected;
}

export function selectProjectCapabilities(
	entry: CollectionEntry<"posts">,
	limit = 3,
): { visible: string[]; additionalCount: number } {
	const explicitMetadata = (entry.data.capabilities || []).map(
		(label, index) => ({ label, weight: 80, index }),
	);
	const documentedCapabilities = (
		entry.data.views?.executive?.key_capabilities || []
	).map((label, index) => ({ label, weight: 72, index }));
	const fallbackSources = [
		...(entry.data.technologies || []).map((label, index) => ({
			label,
			weight: 58,
			index,
		})),
		...(entry.data.tags || []).map((label, index) => ({
			label,
			weight: 42,
			index,
		})),
	];
	const sources = explicitMetadata.length
		? explicitMetadata
		: documentedCapabilities.length
			? documentedCapabilities
			: fallbackSources;
	const byName = new Map<
		string,
		{ label: string; weight: number; index: number }
	>();
	for (const source of sources) {
		const key = normalize(source.label);
		if (!key || GENERIC_CAPABILITIES.has(key)) continue;
		const current = byName.get(key);
		if (!current || source.weight > current.weight) byName.set(key, source);
	}
	const candidates: CapabilityCandidate[] = [...byName.entries()]
		.map(([key, source]) => {
			const classification = classifyCapability(source.label);
			return {
				label: source.label,
				key,
				group: classification.group,
				score:
					source.weight +
					classification.weight +
					Math.min(12, source.label.trim().split(/\s+/).length * 3) -
					source.index * 0.01,
			};
		})
		.sort(
			(left, right) =>
				right.score - left.score || left.label.localeCompare(right.label),
		);
	const selected: CapabilityCandidate[] = [];
	const selectedKeys = new Set<string>();
	for (const group of [
		"business",
		"method",
		"platform",
		"deployment",
	] as const) {
		const candidate = candidates.find(
			(item) => item.group === group && !selectedKeys.has(item.key),
		);
		if (candidate && selected.length < limit) {
			selected.push(candidate);
			selectedKeys.add(candidate.key);
		}
	}
	for (const candidate of candidates) {
		if (selected.length >= limit) break;
		if (selectedKeys.has(candidate.key)) continue;
		selected.push(candidate);
		selectedKeys.add(candidate.key);
	}
	const documented = uniqueValues(sources.map(({ label }) => label));
	return {
		visible: selected.map((item) => item.label),
		additionalCount: Math.max(0, documented.length - selected.length),
	};
}

function extractMarkdownLinks(body: string): LinkCandidate[] {
	const links: LinkCandidate[] = [];
	const pattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)[^)]*\)/g;
	while (true) {
		const match = pattern.exec(String(body || ""));
		if (!match) break;
		links.push({ label: stripMarkdown(match[1]), url: match[2] });
	}
	return links;
}

function normalizeGithubUrl(value: string): string {
	try {
		const parsed = new URL(value);
		if (parsed.hostname.toLowerCase() !== "github.com") return "";
		const parts = parsed.pathname.split("/").filter(Boolean);
		return parts.length >= 2
			? `https://github.com/${parts[0]}/${parts[1]}`
			: "";
	} catch {
		return "";
	}
}

function linkCandidates(entry: CollectionEntry<"posts">): LinkCandidate[] {
	const body = entry.body || "";
	const links: LinkCandidate[] = [...extractMarkdownLinks(body)];
	// Some posts document repository links as plain text instead of Markdown
	// links or ::github directives. Normalize escaped URL punctuation and keep
	// those repositories in the same metadata pipeline as other projects.
	const normalizedBody = body.replace(/https\\:\/\//g, "https://");
	const plainGithubPattern = /https?:\/\/github\.com\/[\w.-]+\/[\w.-]+[^\s<>)\]]*/gi;
	for (const match of normalizedBody.matchAll(plainGithubPattern)) {
		const url = match[0].replace(/[.,;:]+$/, "");
		links.push({ label: "GitHub", url });
	}
	const add = (label: string, value?: string) => {
		if (value?.trim()) links.unshift({ label, url: value.trim() });
	};
	add("Live Demo", entry.data.demo_url);
	add("GitHub", entry.data.github_url);
	add("Paper", entry.data.paper_url);
	add("Documentation", entry.data.documentation_url);
	add("Video", entry.data.video_url);
	for (const link of entry.data.project_links || [])
		links.unshift({ label: link.label, url: link.url });
	const youtube =
		typeof entry.data.youtube === "string"
			? entry.data.youtube
			: entry.data.youtube?.url;
	add("Video", youtube);
	const repo = body.match(/::github\{repo=[\x22']([^\x22']+)[\x22']\}/)?.[1];
	if (repo?.includes("/"))
		links.unshift({ label: "GitHub", url: `https://github.com/${repo}` });
	const iframe = body.match(
		/<iframe[^>]+src=[\x22'](https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)[^\x22']+)[\x22']/i,
	)?.[1];
	if (iframe) links.unshift({ label: "Video", url: iframe });
	return links;
}

function directLinks(entry: CollectionEntry<"posts">) {
	const links = linkCandidates(entry);
	const find = (predicate: (link: LinkCandidate) => boolean) =>
		links.find(predicate)?.url || "";
	const github = find((link) => Boolean(normalizeGithubUrl(link.url)));
	const demo = find((link) => {
		const value = normalize(`${link.label} ${link.url}`);
		return (
			(value.includes("demo") ||
				value.includes("live app") ||
				value.includes("huggingface.co/spaces") ||
				value.includes("streamlit.app")) &&
			!value.includes("demo video") &&
			!value.includes("youtube")
		);
	});
	const video = find((link) => {
		const value = normalize(`${link.label} ${link.url}`);
		return (
			value.includes("video") ||
			value.includes("youtube.com") ||
			value.includes("youtu.be")
		);
	});
	const paper = find((link) => {
		const value = normalize(`${link.label} ${link.url}`);
		return (
			value.includes("paper") ||
			value.includes("publication") ||
			value.includes("arxiv.org") ||
			value.includes("doi.org")
		);
	});
	return { github: normalizeGithubUrl(github), demo, video, paper };
}

function relativeEntryDirectory(entry: CollectionEntry<"posts">): string {
	return getDir(entry.id).replace(/^[/\\]+/, "");
}

function publicPath(value: string): string {
	const base = String(import.meta.env.BASE_URL || "/").replace(/^\/|\/$/g, "");
	let result = value.replace(/^\/+/, "");
	if (base && result.startsWith(`${base}/`))
		result = result.slice(base.length + 1);
	return result;
}

function verifiedPublicAsset(value: string): boolean {
	if (!value) return false;
	if (/^https?:\/\//i.test(value)) return true;
	return (
		value.startsWith("/") &&
		existsSync(path.join(process.cwd(), "public", publicPath(value)))
	);
}

function usableImage(entry: CollectionEntry<"posts">, value: string): boolean {
	if (!value) return false;
	if (/^https?:\/\//i.test(value)) return true;
	if (value.startsWith("/")) return verifiedPublicAsset(value);
	const postsRoot = path.resolve(process.cwd(), "src", "content", "posts");
	const srcRoot = path.dirname(path.dirname(postsRoot));
	const file = path.resolve(postsRoot, relativeEntryDirectory(entry), value);
	return file.startsWith(srcRoot + path.sep) && existsSync(file);
}

function markdownImages(body: string): Array<{ src: string; alt: string }> {
	const images: Array<{ src: string; alt: string }> = [];
	const pattern = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+[\x22'][^\x22']*[\x22'])?\)/g;
	while (true) {
		const match = pattern.exec(String(body || ""));
		if (!match) break;
		images.push({ alt: stripMarkdown(match[1]), src: match[2].trim() });
	}
	return images;
}

function isArchitecturePreview(src: string, alt: string): boolean {
	const description = `${alt} ${src}`.replace(/[-_]+/g, " ");
	return (
		ARCHITECTURE_PREVIEW_PATTERN.test(description) &&
		!NON_ARCHITECTURE_PREVIEW_PATTERN.test(description)
	);
}

function cardImage(
	entry: CollectionEntry<"posts">,
	title: string,
): ProjectCardImage | undefined {
	const basePath = path.join("content/posts/", getDir(entry.id));
	const fitFor = (src: string, alt: string): ProjectCardImage["fit"] =>
		isArchitecturePreview(src, alt) ? "contain" : "cover";
	const explicit = entry.data.card_image;
	if (explicit?.src && usableImage(entry, explicit.src)) {
		return {
			src: explicit.src,
			alt: explicit.alt,
			basePath,
			fit: fitFor(explicit.src, explicit.alt),
			architecture: isArchitecturePreview(explicit.src, explicit.alt),
		};
	}
	if (entry.data.image && usableImage(entry, entry.data.image)) {
		const alt = `${title} project preview`;
		return {
			src: entry.data.image,
			darkSrc:
				entry.data.image_dark && usableImage(entry, entry.data.image_dark)
					? entry.data.image_dark
					: undefined,
			alt,
			basePath,
			fit: fitFor(entry.data.image, alt),
			architecture: isArchitecturePreview(entry.data.image, alt),
		};
	}
	const images = markdownImages(entry.body || "");
	const architecture =
		entry.data.architecture?.src &&
		usableImage(entry, entry.data.architecture.src)
			? {
					src: entry.data.architecture.src,
					alt: entry.data.architecture.alt || `${title} architecture preview`,
				}
			: images.find((image) => isArchitecturePreview(image.src, image.alt));
	if (architecture?.src && usableImage(entry, architecture.src)) {
		return {
			src: architecture.src,
			alt: architecture.alt || `${title} architecture preview`,
			basePath,
			fit: "contain",
			architecture: true,
		};
	}
	const first = images.find(
		(image) =>
			!/(badge|icon|logo|shield)/i.test(`${image.alt} ${image.src}`) &&
			usableImage(entry, image.src),
	);
	if (!first) return undefined;
	const alt = first.alt || `${title} project preview`;
	return {
		src: first.src,
		alt,
		basePath,
		fit: fitFor(first.src, alt),
		architecture: isArchitecturePreview(first.src, alt),
	};
}

function hasHeading(body: string, pattern: RegExp): boolean {
	return String(body || "")
		.split(/\r?\n/)
		.some((line) => {
			const heading = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/)?.[1];
			return heading ? pattern.test(stripMarkdown(heading)) : false;
		});
}

function evidenceData(
	entry: CollectionEntry<"posts">,
	projectUrl: string,
	pdfUrl: string,
): ProjectCardEvidence[] {
	const body = entry.body || "";
	const direct = directLinks(entry);
	const documentedLinks = linkCandidates(entry);
	const linkedEvidence = (pattern: RegExp) =>
		documentedLinks.find((link) =>
			pattern.test(normalize(`${link.label} ${link.url}`)),
		)?.url || "";
	const hasArchitecture =
		Boolean(linkedEvidence(/architecture|diagram|system design/)) ||
		Boolean(entry.data.architecture?.src) ||
		markdownImages(body).some((image) =>
			/architecture|diagram|flow|pipeline|system/i.test(
				`${image.alt} ${image.src}`,
			),
		) ||
		hasHeading(body, /architecture|system design|solution design/i);
	const hasDashboard =
		Boolean(linkedEvidence(/dashboard|live app/)) ||
		hasHeading(body, /dashboard|user interface|application experience/i) ||
		/\b(streamlit|dashboard)\b/i.test(
			`${entry.data.description} ${(entry.data.tags || []).join(" ")}`,
		);
	const hasDataset =
		Boolean(linkedEvidence(/dataset|data set|kaggle/)) ||
		Boolean(entry.data.dataset) ||
		hasHeading(body, /dataset|data model|data source/i);
	const hasMetrics =
		Boolean(linkedEvidence(/metrics|evaluation results|benchmark results/)) ||
		Boolean(entry.data.results) ||
		hasHeading(body, /metrics|results|evaluation|benchmark/i);
	const evidence: ProjectCardEvidence[] = [];
	const add = (label: string, url: string, isDirect: boolean) => {
		if (!url || evidence.some((item) => item.label === label)) return;
		evidence.push({
			label,
			url,
			direct: isDirect,
			external: /^https?:\/\//i.test(url),
		});
	};
	const architectureUrl = linkedEvidence(/architecture|diagram|system design/);
	const dashboardUrl = linkedEvidence(/dashboard|live app/);
	const datasetEvidenceUrl = linkedEvidence(/dataset|data set|kaggle/);
	const metricsUrl = linkedEvidence(
		/metrics|evaluation results|benchmark results/,
	);
	if (architectureUrl) add("Architecture", architectureUrl, true);
	if (dashboardUrl) add("Dashboard", dashboardUrl, true);
	if (datasetEvidenceUrl) add("Dataset", datasetEvidenceUrl, true);
	if (metricsUrl) add("Metrics", metricsUrl, true);
	if (hasArchitecture) add("Architecture", projectUrl, false);
	if (hasDashboard) add("Dashboard", projectUrl, false);
	if (direct.demo) add("Demo", direct.demo, true);
	if (direct.github) add("GitHub", direct.github, true);
	if (direct.video) add("Video", direct.video, true);
	if (pdfUrl && verifiedPublicAsset(pdfUrl)) add("PDF", pdfUrl, true);
	if (direct.paper) add("Paper", direct.paper, true);
	if (hasDataset) {
		const datasetUrl = /^https?:\/\//i.test(entry.data.dataset || "")
			? entry.data.dataset
			: projectUrl;
		add("Dataset", datasetUrl, datasetUrl !== projectUrl);
	}
	if (hasMetrics) add("Metrics", projectUrl, false);
	const sortedEvidence = evidence.sort(
		(left, right) =>
			EVIDENCE_ORDER.indexOf(left.label) - EVIDENCE_ORDER.indexOf(right.label),
	);
	const directUrls = new Set<string>();
	return sortedEvidence.filter((item) => {
		if (!item.direct) return true;
		const key = normalize(item.url);
		if (!key || directUrls.has(key)) return false;
		directUrls.add(key);
		return true;
	});
}

function actionData(
	entry: CollectionEntry<"posts">,
	pdfUrl: string,
): ProjectCardAction[] {
	const direct = directLinks(entry);
	const actions: ProjectCardAction[] = [];
	const add = (label: string, url: string, kind: ProjectCardAction["kind"]) => {
		if (!url || actions.some((action) => action.kind === kind)) return;
		actions.push({ label, url, kind, external: /^https?:\/\//i.test(url) });
	};
	add("Demo", direct.demo, "demo");
	add("GitHub", direct.github, "github");
	add("Video", direct.video, "video");
	if (pdfUrl && verifiedPublicAsset(pdfUrl)) add("PDF", pdfUrl, "pdf");
	return actions;
}

export function buildProjectCardData(
	entry: CollectionEntry<"posts">,
	projectUrl: string,
	pdfUrl: string,
): ProjectCardData {
	const fullTitle = entry.data.title.trim();
	const explicitCardTitle = entry.data.card_title?.trim();
	const titledProjectName = fullTitle.match(/^([^:]{2,80}):\s+/)?.[1]?.trim();
	const displayTitle = compactDisplayTitle(
		explicitCardTitle || titledProjectName || fullTitle,
	);
	const hasDisplayTitle = Boolean(
		explicitCardTitle || titledProjectName || displayTitle !== fullTitle,
	);
	const summary = stripMarkdown(entry.data.description || "");
	let problem = getProblem(entry);
	let solution = getSolution(entry);
	const summaryKey = comparisonKey(summary);
	const problemKey = comparisonKey(problem);
	const solutionKey = comparisonKey(solution);
	if (problemKey && problemKey === summaryKey) problem = "";
	if (solutionKey && (solutionKey === summaryKey || solutionKey === problemKey))
		solution = "";
	const capabilityData = selectProjectCapabilities(entry, 2);
	const capabilities = capabilityData.visible;
	const additionalCapabilityCount = capabilityData.additionalCount;
	const allActions = actionData(entry, pdfUrl);
	const actionByKind = new Map(
		allActions.map((action) => [action.kind, action]),
	);
	const fixedFooterActions = (["github", "pdf"] as const)
		.map((kind) => actionByKind.get(kind))
		.filter((action): action is ProjectCardAction => Boolean(action));
	const supportingFooterActions = (["demo", "video"] as const)
		.map((kind) => actionByKind.get(kind))
		.filter((action): action is ProjectCardAction => Boolean(action));
	const footerDisplayOrder: ProjectCardAction["kind"][] = [
		"demo",
		"github",
		"pdf",
		"video",
	];
	const actions = [...fixedFooterActions, ...supportingFooterActions]
		.slice(0, 2)
		.sort(
			(left, right) =>
				footerDisplayOrder.indexOf(left.kind) -
				footerDisplayOrder.indexOf(right.kind),
		);
	const footerActionUrls = new Set(actions.map(({ url }) => url));
	const footerActionLabels = new Set(
		actions.map(({ label }) => normalize(label)),
	);
	const documentedEvidence = evidenceData(entry, projectUrl, pdfUrl);
	const allEvidence = documentedEvidence.filter(
		(item) =>
			!footerActionUrls.has(item.url) &&
			!footerActionLabels.has(normalize(item.label)),
	);
	const evidence = allEvidence.slice(0, 2);
	const derivedMaturity = entry.data.status
		? undefined
		: getDocumentedProjectMaturity(entry);
	const documentedStatus =
		entry.data.status ||
		(derivedMaturity
			? { type: derivedMaturity, label: COMPACT_STATUS_LABELS[derivedMaturity] }
			: undefined);
	const featuredSource = documentedEvidence.find((item) =>
		[
			"Demo",
			"Architecture",
			"Paper",
			"Video",
			"Dataset",
			"Metrics",
			"GitHub",
			"PDF",
		].includes(item.label),
	);
	const featuredEvidence: ProjectCardEvidence | undefined =
		documentedStatus?.type === "production"
			? {
					label: "Production",
					url: projectUrl,
					external: false,
					direct: false,
				}
			: featuredSource
				? {
						...featuredSource,
						label:
							featuredSource.label === "Demo"
								? "Live Demo"
								: featuredSource.label,
					}
				: undefined;
	const maturitySummary = uniqueValues([
		documentedStatus ? COMPACT_STATUS_LABELS[documentedStatus.type] : "",
		featuredEvidence?.label === "Production"
			? ""
			: featuredEvidence?.label || "",
		...documentedEvidence
			.map((item) => (item.label === "Demo" ? "Live Demo" : item.label))
			.filter(
				(label) =>
					normalize(label) !== normalize(featuredEvidence?.label || ""),
			),
	]).slice(0, documentedStatus ? 3 : 2);
	const architectureEvidence = documentedEvidence.find(
		(item) => item.label === "Architecture",
	);
	const demoAction = allActions.find((action) => action.kind === "demo");
	const quickActions: ProjectCardData["quickActions"] = [
		architectureEvidence
			? {
					label: "Architecture" as const,
					url: architectureEvidence.url,
					external: architectureEvidence.external,
				}
			: null,
		demoAction
			? {
					label: "Live Demo" as const,
					url: demoAction.url,
					external: demoAction.external,
				}
			: null,
	].filter((action): action is ProjectCardData["quickActions"][number] =>
		Boolean(action),
	);
	const fallbackPresentation = getProjectDomainPresentation(entry);
	const realImage = cardImage(entry, fullTitle);
	const generatedCover = realImage
		? undefined
		: generateProjectCardCover({
				title: fullTitle,
				projectType: entry.data.category?.trim() || "Project",
				domain: fallbackPresentation.name,
				capability: capabilities[0],
				icon: fallbackPresentation.icon,
				accentColor: fallbackPresentation.color,
				keywords: [
					entry.data.description || "",
					...(entry.data.capabilities || []),
					...(entry.data.technologies || []),
					...(entry.data.tags || []),
				],
			});
	const image: ProjectCardImage = realImage || {
		src: generatedCover?.src || "",
		alt: generatedCover?.alt || `${displayTitle} project cover`,
		basePath: "",
		fit: "cover",
		generated: true,
	};
	return {
		fullTitle,
		displayTitle,
		hasDisplayTitle,
		summary,
		problem,
		solution,
		capabilities,
		additionalCapabilityCount,
		status: documentedStatus
			? {
					label: COMPACT_STATUS_LABELS[documentedStatus.type],
					type: documentedStatus.type,
				}
			: undefined,
		image,
		evidence,
		additionalEvidenceCount: Math.max(0, allEvidence.length - evidence.length),
		actions,
		featuredEvidence,
		maturitySummary,
		whyItMatters: getWhyItMatters(entry, problem),
		quickActions,
	};
}
