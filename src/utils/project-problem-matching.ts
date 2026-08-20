import type { CollectionEntry } from "astro:content";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import {
	GENERIC_PROJECT_PROBLEM_TAGS,
	type ProjectProblemDefinition,
	projectProblems,
} from "@/config/project-problems";
import { formatDateToYYYYMMDD } from "./date-utils";
import { getPostPdfPath } from "./pdf-utils";
import { getDir, getPostUrlBySlug, url } from "./url-utils";

export interface ProjectProblemMatch {
	problemId: string;
	score: number;
	matchedTags: string[];
	matchedKeywords: string[];
	matchedCategories: string[];
	matchReason: string;
	explicitMatch: boolean;
	useCases: string[];
	useCaseKeys: string[];
}

export interface ProjectProblemTechnology {
	label: string;
	key: string;
	count: number;
}

export interface ProjectProblemUseCaseResult {
	label: string;
	key: string;
	count: number;
}

export interface ProjectProblemAction {
	label: string;
	url: string;
	external: boolean;
	kind: "demo" | "docs" | "github" | "paper" | "video" | "pdf";
}

export interface ProjectArchitecturePreview {
	src: string;
	alt: string;
	status: "available" | "inside-project" | "missing";
}

export interface ProjectProblemProject {
	id: string;
	title: string;
	url: string;
	date: string;
	year: string;
	category: string;
	description: string;
	tags: string[];
	technologyTags: string[];
	assetBasePath: string;
	image: string;
	architecturePreview: ProjectArchitecturePreview;
	actions: ProjectProblemAction[];
	matches: ProjectProblemMatch[];
}

export interface ProjectProblemResult {
	id: string;
	label: string;
	description: string;
	icon: string;
	count: number;
	projects: {
		project: ProjectProblemProject;
		match: ProjectProblemMatch;
	}[];
	technologies: ProjectProblemTechnology[];
	useCases: ProjectProblemUseCaseResult[];
	relatedProblems: {
		id: string;
		label: string;
		count: number;
	}[];
}

export interface ProjectProblemExplorerData {
	problems: ProjectProblemResult[];
	projects: ProjectProblemProject[];
}

type InternalProject = ProjectProblemProject & {
	bodyText: string;
	fullText: string;
	publishedMs: number;
	featured: boolean;
};

type MarkdownLink = {
	label: string;
	url: string;
};

export const PROJECT_PROBLEM_MATCH_WEIGHTS = {
	explicit: 100,
	exactTag: 8,
	exactCategory: 5,
	titleKeyword: 4,
	descriptionKeyword: 2,
} as const;

const PROBLEM_MATCH_THRESHOLD = PROJECT_PROBLEM_MATCH_WEIGHTS.exactTag;
const STRONG_AUTOMATIC_THRESHOLD =
	PROJECT_PROBLEM_MATCH_WEIGHTS.exactTag +
	PROJECT_PROBLEM_MATCH_WEIGHTS.titleKeyword +
	PROJECT_PROBLEM_MATCH_WEIGHTS.descriptionKeyword;

function normalizeValue(value: string): string {
	return String(value || "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim()
		.toLowerCase();
}
const genericProblemTags = new Set(
	[...GENERIC_PROJECT_PROBLEM_TAGS].map((tag) => normalizeValue(tag)),
);

export function toFilterKey(value: string): string {
	return normalizeValue(value)
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

const RECOMMENDATION_DISPLAY_LABELS: Record<string, string> = {
	ocr: "OCR",
	llm: "LLM",
	llminference: "LLM Inference",
	"llm-inference": "LLM Inference",
	computer_vision: "Computer Vision",
	"computer-vision": "Computer Vision",
	computervision: "Computer Vision",
	multimodal: "Multimodal AI",
	"multimodal-ai": "Multimodal AI",
	genai: "Generative AI",
	generative: "Generative AI",
	"generative-ai": "Generative AI",
	agent: "Agentic AI",
	agents: "Agentic AI",
	"agentic-ai": "Agentic AI",
	chat: "Conversational AI",
	retrieval: "Information Retrieval",
	detection: "Object Detection",
	inspection: "Visual Inspection",
	image: "Image Analysis",
	video: "Video Intelligence",
	camera: "Camera Analytics",
	maintenance: "Predictive Maintenance",
	generator: "Generator Reliability",
	failure: "Failure Risk Forecasting",
	forecast: "Forecasting",
	risk: "Risk Analysis",
	asset: "Asset Intelligence",
	reliability: "Reliability Engineering",
	telemetry: "Telemetry Analytics",
	voice: "Voice AI",
	"digital-human": "Digital Human",
	logistics: "Logistics Optimization",
	routing: "Route Optimization",
	route: "Route Optimization",
	warehouse: "Warehouse Operations",
	fleet: "Fleet Optimization",
	dispatch: "Dispatch Optimization",
	medical: "Healthcare AI",
	healthcare: "Healthcare AI",
	clinical: "Clinical Decision Support",
	claim: "Claims Intelligence",
	insurance: "Insurance AI",
	patient: "Clinical Decision Support",
	diagnosis: "Clinical Decision Support",
	security: "Security",
	identity: "Decentralized Identity",
	credential: "Verifiable Credentials",
	credentials: "Verifiable Credentials",
	privacy: "Privacy Engineering",
	proof: "Zero-Knowledge Proofs",
	devsecops: "DevSecOps",
	policy: "Policy Automation",
	automation: "Workflow Automation",
};

export function toRecommendationDisplayLabel(value: string): string {
	const raw = String(value || "").trim();
	if (!raw) return "";
	const normalizedKey = toFilterKey(raw);
	const compactKey = normalizedKey.replace(/-/g, "");
	const mapped =
		RECOMMENDATION_DISPLAY_LABELS[raw.toLowerCase()] ||
		RECOMMENDATION_DISPLAY_LABELS[normalizedKey] ||
		RECOMMENDATION_DISPLAY_LABELS[compactKey];
	if (mapped) return mapped;

	return raw
		.replace(/_+/g, " ")
		.replace(/\b\w/g, (letter) => letter.toUpperCase())
		.replace(/\bAi\b/g, "AI")
		.replace(/\bMlops\b/g, "MLOps")
		.replace(/\bLlm\b/g, "LLM");
}

function uniqueValues(values: string[]): string[] {
	const seen = new Set<string>();
	const unique: string[] = [];

	for (const value of values) {
		const normalized = normalizeValue(value);
		if (!normalized || seen.has(normalized)) continue;
		seen.add(normalized);
		unique.push(value.trim());
	}

	return unique;
}

function includesTerm(text: string, term: string): boolean {
	const normalizedText = ` ${normalizeValue(text).replace(/[^a-z0-9]+/g, " ")} `;
	const normalizedTerm = ` ${normalizeValue(term).replace(/[^a-z0-9]+/g, " ")} `;
	return (
		normalizedTerm.trim().length > 0 && normalizedText.includes(normalizedTerm)
	);
}

function stripMarkdown(value: string): string {
	return value
		.replace(/^---[\s\S]*?---/m, " ")
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/::[\w-]+(?:\{[^}]*\})?/g, " ")
		.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/^#+\s+/gm, " ")
		.replace(/[*_`>#|{}[\]():;-]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function getExplicitProblemIds(entry: CollectionEntry<"posts">): string[] {
	return uniqueValues(entry.data.problems || [])
		.map(toFilterKey)
		.filter(Boolean);
}

function buildDerivedProblemDefinition(id: string): ProjectProblemDefinition {
	const label = id
		.split("-")
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");

	return {
		id,
		label,
		description: "Projects explicitly mapped to this problem area.",
		icon: "material-symbols:category-outline-rounded",
		tags: [],
		keywords: [],
		relatedProblems: [],
		useCases: [],
	};
}

function getProblemDefinitions(
	entries: CollectionEntry<"posts">[],
): ProjectProblemDefinition[] {
	const configuredIds = new Set(projectProblems.map((problem) => problem.id));
	const explicitIds = uniqueValues(
		entries.flatMap((entry) => getExplicitProblemIds(entry)),
	);
	const derived = explicitIds
		.filter((id) => !configuredIds.has(id))
		.map(buildDerivedProblemDefinition);

	return [...projectProblems, ...derived];
}

export function matchProjectProblems(
	entry: CollectionEntry<"posts">,
	definitions: ProjectProblemDefinition[] = projectProblems,
): ProjectProblemMatch[] {
	const explicitProblemIds = new Set(getExplicitProblemIds(entry));
	const tags = uniqueValues(entry.data.tags || []);
	const normalizedTags = new Map(tags.map((tag) => [normalizeValue(tag), tag]));
	const category = entry.data.category?.trim() || "";
	const title = entry.data.title || "";
	const description = entry.data.description || "";
	const hasExplicitProblems = explicitProblemIds.size > 0;
	const matches: ProjectProblemMatch[] = [];

	for (const problem of definitions) {
		let score = 0;
		const explicitMatch = explicitProblemIds.has(problem.id);
		const matchedTags: string[] = [];
		const matchedKeywords: string[] = [];
		const matchedCategories: string[] = [];

		if (explicitMatch) score += PROJECT_PROBLEM_MATCH_WEIGHTS.explicit;

		for (const problemTag of problem.tags) {
			const tag = normalizedTags.get(normalizeValue(problemTag));
			if (tag && !genericProblemTags.has(normalizeValue(tag))) {
				score += PROJECT_PROBLEM_MATCH_WEIGHTS.exactTag;
				matchedTags.push(tag);
			}
		}

		for (const problemCategory of problem.categories || []) {
			if (
				category &&
				normalizeValue(category) === normalizeValue(problemCategory)
			) {
				score += PROJECT_PROBLEM_MATCH_WEIGHTS.exactCategory;
				matchedCategories.push(category);
			}
		}

		for (const keyword of problem.keywords) {
			let matched = false;
			if (includesTerm(title, keyword)) {
				score += PROJECT_PROBLEM_MATCH_WEIGHTS.titleKeyword;
				matched = true;
			}
			if (includesTerm(description, keyword)) {
				score += PROJECT_PROBLEM_MATCH_WEIGHTS.descriptionKeyword;
				matched = true;
			}
			if (matched) matchedKeywords.push(keyword);
		}

		const qualifies =
			explicitMatch ||
			(!hasExplicitProblems && score >= PROBLEM_MATCH_THRESHOLD) ||
			(hasExplicitProblems && score >= STRONG_AUTOMATIC_THRESHOLD);

		if (!qualifies) continue;

		const displayTags = uniqueValues(
			matchedTags.map(toRecommendationDisplayLabel),
		).slice(0, 4);
		const displayKeywords = uniqueValues(
			matchedKeywords.map(toRecommendationDisplayLabel),
		).slice(0, 4);
		let matchReason = "Related project context.";
		if (explicitMatch) {
			matchReason = `Problem fit: ${problem.label}.`;
		} else if (matchedTags.length > 0) {
			matchReason = `Shared focus: ${displayTags.join(" · ")}.`;
		} else if (matchedKeywords.length > 0) {
			matchReason = `Related capabilities: ${displayKeywords.join(" · ")}.`;
		} else if (matchedCategories.length > 0) {
			matchReason = `Shared project context: ${toRecommendationDisplayLabel(matchedCategories[0])}.`;
		}

		matches.push({
			problemId: problem.id,
			score,
			matchedTags: uniqueValues(matchedTags),
			matchedKeywords: uniqueValues(matchedKeywords),
			matchedCategories: uniqueValues(matchedCategories),
			matchReason,
			explicitMatch,
			useCases: [],
			useCaseKeys: [],
		});
	}

	return matches.sort((a, b) => {
		if (a.explicitMatch !== b.explicitMatch) return a.explicitMatch ? -1 : 1;
		if (a.score !== b.score) return b.score - a.score;
		return a.problemId.localeCompare(b.problemId);
	});
}

function getTechnologyTags(
	tags: string[],
	explicitTechnologies: string[] = [],
): string[] {
	const candidates = uniqueValues([...explicitTechnologies, ...tags]);
	const specific = candidates.filter(
		(tag) => !genericProblemTags.has(normalizeValue(tag)),
	);
	return specific.length > 0 ? specific : candidates;
}

function extractMarkdownLinks(body: string): MarkdownLink[] {
	const links: MarkdownLink[] = [];
	const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)[^)]*\)/g;

	while (true) {
		const match = linkPattern.exec(body);
		if (!match) break;
		links.push({
			label: stripMarkdown(match[1]),
			url: match[2],
		});
	}

	return links;
}

function normalizeGithubRepositoryUrl(rawUrl: string): string {
	try {
		const parsed = new URL(rawUrl);
		if (parsed.hostname !== "github.com") return "";
		const parts = parsed.pathname.split("/").filter(Boolean);
		if (parts.length < 2) return "";
		return `https://github.com/${parts[0]}/${parts[1]}`;
	} catch {
		return "";
	}
}

function getProjectActions(
	entry: CollectionEntry<"posts">,
): ProjectProblemAction[] {
	const body = entry.body || "";
	const normalizedBody = body.replace(/https\\:\/\//g, "https://");
	const links = [
		...extractMarkdownLinks(body),
		...Array.from(
			normalizedBody.matchAll(
				/https?:\/\/github\.com\/[\w.-]+\/[\w.-]+[^\s<>)\]]*/gi,
			),
		).map((match) => ({
			label: "GitHub",
			url: match[0].replace(/[.,;:]+$/, ""),
		})),
	];
	const actions: ProjectProblemAction[] = [];
	const explicitActions: ProjectProblemAction[] = [
		entry.data.demo_url
			? {
					label: "Live Demo",
					url: entry.data.demo_url,
					external: /^https?:\/\//i.test(entry.data.demo_url),
					kind: "demo",
				}
			: null,
		entry.data.github_url
			? {
					label: "GitHub",
					url: entry.data.github_url,
					external: /^https?:\/\//i.test(entry.data.github_url),
					kind: "github",
				}
			: null,
		entry.data.paper_url
			? {
					label: "Paper",
					url: entry.data.paper_url,
					external: /^https?:\/\//i.test(entry.data.paper_url),
					kind: "paper",
				}
			: null,
		entry.data.documentation_url
			? {
					label: "Documentation",
					url: entry.data.documentation_url,
					external: /^https?:\/\//i.test(entry.data.documentation_url),
					kind: "docs",
				}
			: null,
		entry.data.video_url
			? {
					label: "Video",
					url: entry.data.video_url,
					external: /^https?:\/\//i.test(entry.data.video_url),
					kind: "video",
				}
			: null,
	].filter((action): action is ProjectProblemAction => Boolean(action));
	const structuredActions: ProjectProblemAction[] = [];
	for (const link of entry.data.project_links || []) {
		const normalizedKind = link.kind === "documentation" ? "docs" : link.kind;
		const inferredKind = normalizeValue(`${link.label} ${link.url}`);
		const kind =
			normalizedKind === "demo" ||
			normalizedKind === "github" ||
			normalizedKind === "paper" ||
			normalizedKind === "docs" ||
			normalizedKind === "video"
				? normalizedKind
				: inferredKind.includes("github")
					? "github"
					: inferredKind.includes("demo") || inferredKind.includes("live app")
						? "demo"
						: inferredKind.includes("paper") ||
								inferredKind.includes("publication")
							? "paper"
							: inferredKind.includes("documentation") ||
									inferredKind.includes("docs") ||
									inferredKind.includes("wiki")
								? "docs"
								: inferredKind.includes("video") ||
										inferredKind.includes("youtube")
									? "video"
									: null;
		if (!kind) continue;
		structuredActions.push({
			label: link.label,
			url: link.url,
			external: /^https?:\/\//i.test(link.url),
			kind,
		});
	}
	const youtubeUrl =
		typeof entry.data.youtube === "string"
			? entry.data.youtube
			: entry.data.youtube?.url || "";
	if (youtubeUrl) {
		structuredActions.push({
			label:
				typeof entry.data.youtube === "object"
					? entry.data.youtube.title || "Video"
					: "Video",
			url: youtubeUrl,
			external: /^https?:\/\//i.test(youtubeUrl),
			kind: "video",
		});
	}
	const githubDirective = body.match(/::github\{repo=["']([^"']+)["']\}/);
	const githubFromDirective = githubDirective?.[1]?.includes("/")
		? `https://github.com/${githubDirective[1]}`
		: "";
	const githubFromLink = links
		.map((link) => normalizeGithubRepositoryUrl(link.url))
		.find(Boolean);
	const githubUrl = githubFromDirective || githubFromLink || "";

	const demoLink = links.find((link) => {
		const label = normalizeValue(link.label);
		const href = normalizeValue(link.url);
		if (href.includes("youtube.com/watch") || href.includes("youtu.be/"))
			return false;
		return (
			label.includes("live app") ||
			label.includes("live demo") ||
			label.includes("demo") ||
			label.includes("hugging face") ||
			href.includes("huggingface.co/spaces") ||
			href.includes("streamlit.app")
		);
	});

	const docsLink = links.find((link) => {
		const label = normalizeValue(link.label);
		const href = normalizeValue(link.url);
		return (
			label.includes("documentation") ||
			label.includes("docs") ||
			label.includes("wiki") ||
			label.includes("architecture") ||
			href.includes("/wiki")
		);
	});

	const paperLink = links.find((link) => {
		const label = normalizeValue(link.label);
		const href = normalizeValue(link.url);
		const scholarlyHost =
			href.includes("arxiv.org") ||
			href.includes("doi.org") ||
			href.includes("researchgate.net");
		const linkedDocument = /\.pdf(?:$|[?#])/i.test(link.url);
		return (
			scholarlyHost ||
			(linkedDocument && /\b(paper|publication)\b/i.test(label))
		);
	});

	if (demoLink) {
		actions.push({
			label: "Live Demo",
			url: demoLink.url,
			external: true,
			kind: "demo",
		});
	}
	if (githubUrl) {
		actions.push({
			label: "GitHub",
			url: githubUrl,
			external: true,
			kind: "github",
		});
	}
	if (paperLink) {
		actions.push({
			label: "Paper",
			url: paperLink.url,
			external: true,
			kind: "paper",
		});
	}
	if (docsLink && docsLink.url !== githubUrl) {
		actions.push({
			label: "Documentation",
			url: docsLink.url,
			external: true,
			kind: "docs",
		});
	}
	actions.push({
		label: "PDF",
		url: url(getPostPdfPath(entry)),
		external: false,
		kind: "pdf",
	});

	const byKind = new Map<ProjectProblemAction["kind"], ProjectProblemAction>();
	for (const action of [...explicitActions, ...structuredActions, ...actions]) {
		if (!action.url || byKind.has(action.kind)) continue;
		byKind.set(action.kind, action);
	}

	return [...byKind.values()];
}

function isArchitectureCandidate(value: string): boolean {
	return /(architecture|diagram|flow|pipeline|system|model)/i.test(value);
}

function extractMarkdownArchitectureImage(
	entry: CollectionEntry<"posts">,
): ProjectArchitecturePreview | null {
	const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;

	while (true) {
		const match = imagePattern.exec(entry.body || "");
		if (!match) break;
		const alt = stripMarkdown(match[1]) || `${entry.data.title} architecture`;
		const src = match[2].trim().split(/\s+(?=["'])/)[0];
		if (!isArchitectureCandidate(`${alt} ${src}`)) continue;
		return {
			src,
			alt,
			status: "available",
		};
	}

	return null;
}

function findLocalArchitectureImage(
	entry: CollectionEntry<"posts">,
): ProjectArchitecturePreview | null {
	const directory = path.join(
		process.cwd(),
		"src",
		"content",
		"posts",
		getDir(entry.id),
	);
	if (!existsSync(directory)) return null;

	const file = readdirSync(directory).find(
		(name) =>
			isArchitectureCandidate(name) && /\.(png|jpe?g|webp|svg)$/i.test(name),
	);

	if (!file) return null;

	return {
		src: `./${file}`,
		alt: `${entry.data.title} architecture preview`,
		status: "available",
	};
}

function getArchitecturePreview(
	entry: CollectionEntry<"posts">,
): ProjectArchitecturePreview {
	const explicit = entry.data.architecture;
	if (explicit?.src) {
		const preview = {
			src: explicit.src,
			alt: explicit.alt || `${entry.data.title} architecture preview`,
			status: "available" as const,
		};
		if (isUsableArchitectureSource(preview.src)) return preview;
	}

	const fromMarkdown = extractMarkdownArchitectureImage(entry);
	if (fromMarkdown && isUsableArchitectureSource(fromMarkdown.src)) {
		return fromMarkdown;
	}

	const fromDirectory = findLocalArchitectureImage(entry);
	if (fromDirectory) return fromDirectory;

	const body = entry.body || "";
	const documentedPreview =
		entry.data.project_intelligence?.field_statuses.architecture_preview;
	if (
		documentedPreview === "documented" ||
		Boolean(entry.data.project_intelligence?.architecture_summary) ||
		isArchitectureCandidate(
			`${entry.data.title} ${entry.data.description} ${body}`,
		) ||
		/```mermaid|flowchart|graph\s+(td|lr|bt|rl)/i.test(body)
	) {
		return {
			src: "",
			alt: "",
			status: "inside-project",
		};
	}

	return {
		src: "",
		alt: "",
		status: "missing",
	};
}

function isUsableArchitectureSource(src: string): boolean {
	if (!src.startsWith("/")) return true;

	const basePath = import.meta.env.BASE_URL.replace(/^\/|\/$/g, "");
	let publicPath = src.replace(/^\/+/, "");
	if (basePath && publicPath.startsWith(`${basePath}/`)) {
		publicPath = publicPath.slice(basePath.length + 1);
	}

	return existsSync(path.join(process.cwd(), "public", publicPath));
}

function getUseCaseMatches(
	problem: ProjectProblemDefinition,
	project: InternalProject,
): ProjectProblemUseCaseResult[] {
	const results: ProjectProblemUseCaseResult[] = [];

	for (const useCase of problem.useCases || []) {
		const matched = useCase.keywords.some((keyword) =>
			includesTerm(project.fullText, keyword),
		);
		if (!matched) continue;
		results.push({
			label: useCase.label,
			key: toFilterKey(useCase.label),
			count: 1,
		});
	}

	return results;
}

function buildProjectRecord(
	entry: CollectionEntry<"posts">,
	definitions: ProjectProblemDefinition[],
): InternalProject {
	const category = entry.data.category?.trim() || "Uncategorized";
	const tags = uniqueValues(entry.data.tags || []);
	const bodyText = stripMarkdown(entry.body || "");
	const fullText = [
		entry.data.title,
		entry.data.description,
		category,
		tags.join(" "),
		bodyText,
	].join(" ");

	return {
		id: toFilterKey(entry.slug),
		title: entry.data.title,
		url: getPostUrlBySlug(entry.slug),
		date: formatDateToYYYYMMDD(entry.data.published),
		year: String(entry.data.published.getFullYear()),
		category,
		description: entry.data.description || "",
		tags,
		technologyTags: getTechnologyTags(tags, entry.data.technologies || []),
		assetBasePath: path.join("content/posts/", getDir(entry.id)),
		image: entry.data.image || "",
		architecturePreview: getArchitecturePreview(entry),
		actions: getProjectActions(entry),
		matches: matchProjectProblems(entry, definitions),
		bodyText,
		fullText,
		publishedMs: entry.data.published.getTime(),
		featured: entry.data.featured === true,
	};
}

function getTechnologyResults(
	projects: InternalProject[],
): ProjectProblemTechnology[] {
	const counts = new Map<string, { label: string; count: number }>();

	for (const project of projects) {
		for (const tag of project.technologyTags) {
			const key = toFilterKey(tag);
			if (!key) continue;
			const current = counts.get(key) || { label: tag, count: 0 };
			current.count += 1;
			counts.set(key, current);
		}
	}

	return [...counts.entries()]
		.map(([key, value]) => ({ key, ...value }))
		.sort((a, b) => {
			if (a.count !== b.count) return b.count - a.count;
			return a.label.localeCompare(b.label);
		});
}

function getUseCaseResults(
	problem: ProjectProblemDefinition,
	projects: InternalProject[],
): ProjectProblemUseCaseResult[] {
	const counts = new Map<string, { label: string; count: number }>();

	for (const project of projects) {
		for (const useCase of getUseCaseMatches(problem, project)) {
			const current = counts.get(useCase.key) || {
				label: useCase.label,
				count: 0,
			};
			current.count += 1;
			counts.set(useCase.key, current);
		}
	}

	return [...counts.entries()]
		.map(([key, value]) => ({ key, ...value }))
		.sort((a, b) => {
			if (a.count !== b.count) return b.count - a.count;
			return a.label.localeCompare(b.label);
		});
}

function attachUseCasesToMatch(
	match: ProjectProblemMatch,
	problem: ProjectProblemDefinition,
	project: InternalProject,
): ProjectProblemMatch {
	const useCases = getUseCaseMatches(problem, project);
	return {
		...match,
		useCases: useCases.map((useCase) => useCase.label),
		useCaseKeys: useCases.map((useCase) => useCase.key),
	};
}

function sortProblemProjects(
	left: { project: InternalProject; match: ProjectProblemMatch },
	right: { project: InternalProject; match: ProjectProblemMatch },
) {
	if (left.match.explicitMatch !== right.match.explicitMatch) {
		return left.match.explicitMatch ? -1 : 1;
	}
	if (left.match.score !== right.match.score) {
		return right.match.score - left.match.score;
	}
	if (left.project.featured !== right.project.featured) {
		return left.project.featured ? -1 : 1;
	}
	if (left.project.publishedMs !== right.project.publishedMs) {
		return right.project.publishedMs - left.project.publishedMs;
	}
	return left.project.title.localeCompare(right.project.title);
}

function computeRelatedProblems(
	problem: ProjectProblemResult,
	allProblems: ProjectProblemResult[],
	definition: ProjectProblemDefinition,
): ProjectProblemResult["relatedProblems"] {
	const configured = new Set(definition.relatedProblems || []);
	const selectedProjectIds = new Set(
		problem.projects.map(({ project }) => project.id),
	);
	const selectedTechKeys = new Set(
		problem.technologies.map((tech) => tech.key),
	);

	return allProblems
		.filter((candidate) => candidate.id !== problem.id && candidate.count > 0)
		.map((candidate) => {
			const sharedProjects = candidate.projects.filter(({ project }) =>
				selectedProjectIds.has(project.id),
			).length;
			const sharedTech = candidate.technologies.filter((tech) =>
				selectedTechKeys.has(tech.key),
			).length;
			const configScore = configured.has(candidate.id) ? 100 : 0;
			return {
				id: candidate.id,
				label: candidate.label,
				count: candidate.count,
				score: configScore + sharedProjects * 12 + sharedTech * 2,
			};
		})
		.filter((candidate) => candidate.score > 0)
		.sort((a, b) => {
			if (a.score !== b.score) return b.score - a.score;
			if (a.count !== b.count) return b.count - a.count;
			return a.label.localeCompare(b.label);
		})
		.slice(0, 4)
		.map(({ id, label, count }) => ({ id, label, count }));
}

export function buildProjectProblemExplorerData(
	entries: CollectionEntry<"posts">[],
): ProjectProblemExplorerData {
	const now = Date.now();
	const publishedEntries = entries.filter(
		(entry) =>
			entry.data.draft !== true && entry.data.published.getTime() <= now,
	);
	const definitions = getProblemDefinitions(publishedEntries);
	const projects = publishedEntries.map((entry) =>
		buildProjectRecord(entry, definitions),
	);

	const problemResults: ProjectProblemResult[] = definitions.map((problem) => {
		const problemProjects = projects
			.map((project) => {
				const match = project.matches.find(
					(candidate) => candidate.problemId === problem.id,
				);
				if (!match) return null;
				return {
					project,
					match: attachUseCasesToMatch(match, problem, project),
				};
			})
			.filter(
				(
					item,
				): item is {
					project: InternalProject;
					match: ProjectProblemMatch;
				} => Boolean(item),
			)
			.sort(sortProblemProjects);

		return {
			id: problem.id,
			label: problem.label,
			description: problem.description,
			icon: problem.icon,
			count: problemProjects.length,
			projects: problemProjects,
			technologies: getTechnologyResults(
				problemProjects.map(({ project }) => project),
			),
			useCases: getUseCaseResults(
				problem,
				problemProjects.map(({ project }) => project),
			),
			relatedProblems: [],
		};
	});

	const definitionById = new Map(
		definitions.map((definition) => [definition.id, definition]),
	);

	for (const problem of problemResults) {
		const definition = definitionById.get(problem.id);
		if (!definition) continue;
		problem.relatedProblems = computeRelatedProblems(
			problem,
			problemResults,
			definition,
		);
	}

	return {
		problems: problemResults,
		projects,
	};
}
