import type { CollectionEntry } from "astro:content";
import { existsSync } from "node:fs";
import path from "node:path";
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
	alt: string;
	basePath: string;
}

export interface ProjectCardData {
	fullTitle: string;
	displayTitle: string;
	summary: string;
	problem: string;
	solution: string;
	capabilities: string[];
	additionalCapabilityCount: number;
	status?: { label: string; type: ProjectCardStatusType };
	image?: ProjectCardImage;
	evidence: ProjectCardEvidence[];
	actions: ProjectCardAction[];
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
	"Architecture",
	"Dashboard",
	"Demo",
	"GitHub",
	"Video",
	"PDF",
	"Paper",
	"Dataset",
	"Metrics",
];

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
	limit = 4,
): { visible: string[]; additionalCount: number } {
	const sources = [
		...(entry.data.capabilities || []).map((label, index) => ({
			label,
			weight: 80,
			index,
		})),
		...(entry.data.views?.executive?.key_capabilities || []).map(
			(label, index) => ({ label, weight: 72, index }),
		),
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
	const documented = uniqueValues([
		...(entry.data.capabilities || []),
		...(entry.data.views?.executive?.key_capabilities || []),
		...(entry.data.technologies || []),
		...(entry.data.tags || []),
	]);
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
	const file = path.resolve(postsRoot, relativeEntryDirectory(entry), value);
	return file.startsWith(postsRoot) && existsSync(file);
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

function cardImage(
	entry: CollectionEntry<"posts">,
	title: string,
): ProjectCardImage | undefined {
	const basePath = path.join("content/posts/", getDir(entry.id));
	const explicit = entry.data.card_image;
	if (explicit?.src && usableImage(entry, explicit.src)) {
		return { src: explicit.src, alt: explicit.alt, basePath };
	}
	if (entry.data.image && usableImage(entry, entry.data.image)) {
		return { src: entry.data.image, alt: `${title} project preview`, basePath };
	}
	const images = markdownImages(entry.body || "");
	const architecture =
		entry.data.architecture?.src &&
		usableImage(entry, entry.data.architecture.src)
			? {
					src: entry.data.architecture.src,
					alt: entry.data.architecture.alt || `${title} architecture preview`,
				}
			: images.find((image) =>
					/architecture|diagram|flow|pipeline|system/i.test(
						`${image.alt} ${image.src}`,
					),
				);
	if (architecture?.src && usableImage(entry, architecture.src)) {
		return {
			src: architecture.src,
			alt: architecture.alt || `${title} architecture preview`,
			basePath,
		};
	}
	const first = images.find(
		(image) =>
			!/(badge|icon|logo|shield)/i.test(`${image.alt} ${image.src}`) &&
			usableImage(entry, image.src),
	);
	return first
		? { src: first.src, alt: first.alt || `${title} project preview`, basePath }
		: undefined;
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
	return evidence.sort(
		(left, right) =>
			EVIDENCE_ORDER.indexOf(left.label) - EVIDENCE_ORDER.indexOf(right.label),
	);
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
	add("Live Demo", direct.demo, "demo");
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
	const displayTitle = entry.data.card_title?.trim() || fullTitle;
	const summary = stripMarkdown(entry.data.description || "");
	let problem = getProblem(entry);
	let solution = getSolution(entry);
	const summaryKey = comparisonKey(summary);
	const problemKey = comparisonKey(problem);
	const solutionKey = comparisonKey(solution);
	if (problemKey && problemKey === summaryKey) problem = "";
	if (solutionKey && (solutionKey === summaryKey || solutionKey === problemKey))
		solution = "";
	const capabilityData = selectProjectCapabilities(entry);
	return {
		fullTitle,
		displayTitle,
		summary,
		problem,
		solution,
		capabilities: capabilityData.visible,
		additionalCapabilityCount: capabilityData.additionalCount,
		status: entry.data.status
			? { label: entry.data.status.label, type: entry.data.status.type }
			: undefined,
		image: cardImage(entry, fullTitle),
		evidence: evidenceData(entry, projectUrl, pdfUrl),
		actions: actionData(entry, pdfUrl),
	};
}
