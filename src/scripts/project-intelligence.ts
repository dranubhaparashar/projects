import type {
	PortfolioActionKind,
	PortfolioDeploymentStatus,
	PortfolioKnowledgeIndex,
	PortfolioKnowledgeProject,
} from "../utils/project-intelligence-index";
import type {
	BrowserAiProgress,
	BrowserAssetUrls,
	BrowserHybridHit,
	BrowserLocalLlmSnapshot,
	BrowserRagAnswer,
} from "./project-intelligence/browser-ai-types";

export interface ProjectIntelligenceController {
	open: () => void;
	ask: (question: string, projectSlug?: string) => void;
	destroy: () => void;
}

const PANEL_TRANSITION_MS = 200;
let activeProjectIntelligenceController: ProjectIntelligenceController | null =
	null;

export interface RankedProject {
	project: PortfolioKnowledgeProject;
	score: number;
	reasons: string[];
}

interface AnswerProject {
	project: PortfolioKnowledgeProject;
	reason: string;
	evidence?: string[];
}

interface AssistantAnswer {
	lead: string;
	projects: AnswerProject[];
	technologies?: string[];
	navigation?: boolean;
}

interface ConversationState {
	lastProjectIds: string[];
	turns: RagConversationTurn[];
}

interface RagConversationTurn {
	role: "user" | "assistant";
	content: string;
}

interface RagSource {
	source_id: string;
	project_id: string;
	project_title: string;
	section: string;
	url: string;
}

interface RagRelatedProject {
	id: string;
	title: string;
	url: string;
}

interface RagAnswer {
	answer: string;
	sources: RagSource[];
	related_projects: RagRelatedProject[];
	retrieval: {
		mode: "hybrid";
		semantic_matches: number;
		context_chunks: number;
		project_ids?: string[];
		timings_ms?: Record<string, number>;
	};
	context?: BrowserHybridHit[];
}

const PROJECT_AI_API_URL = String(
	import.meta.env.PUBLIC_PROJECT_AI_API_URL || "",
)
	.trim()
	.replace(/\/+$/, "");
const configuredTimeout = Number(
	import.meta.env.PUBLIC_PROJECT_AI_TIMEOUT_MS || 25_000,
);
const PROJECT_AI_TIMEOUT_MS = Number.isFinite(configuredTimeout)
	? Math.min(Math.max(configuredTimeout, 5_000), 30_000)
	: 25_000;

const NO_INFORMATION =
	"I could not find that information in the published portfolio.";
const NO_MATCH =
	"I could not find a matching project in the published portfolio.";
const PORTFOLIO_REDIRECT =
	"This assistant answers questions about Anubha\u2019s published projects, technologies and research. Try asking which projects use computer vision, Snowflake or Generative AI.";
const LOCAL_AI_FAILURE_NOTICE =
	"Local AI could not start on this device. The grounded portfolio answer is still available.";

const GENERIC_TERMS = new Set([
	"ai",
	"python",
	"project",
	"projects",
	"application",
	"applications",
	"machine learning",
]);
const STOP_WORDS = new Set([
	"a",
	"about",
	"all",
	"an",
	"and",
	"are",
	"as",
	"at",
	"be",
	"built",
	"do",
	"does",
	"for",
	"from",
	"have",
	"how",
	"i",
	"in",
	"involving",
	"is",
	"me",
	"most",
	"my",
	"of",
	"on",
	"related",
	"relevant",
	"show",
	"that",
	"the",
	"these",
	"this",
	"those",
	"to",
	"use",
	"used",
	"uses",
	"what",
	"which",
	"with",
	"you",
]);

const QUERY_EXPANSIONS: Array<{ pattern: RegExp; terms: string[] }> = [
	{
		pattern: /\bcomputer vision\b/i,
		terms: [
			"computer vision",
			"object detection",
			"video analytics",
			"image processing",
			"yolo",
			"ocr",
		],
	},
	{
		pattern: /\bgenerative ai\b|\bgenai\b/i,
		terms: [
			"generative ai",
			"genai",
			"large language model",
			"llm",
			"rag",
			"language model",
		],
	},
	{
		pattern: /\bmultimodal(?: ai)?\b/i,
		terms: [
			"multimodal ai",
			"multimodal",
			"vision language",
			"image and text",
			"document intelligence",
		],
	},
	{
		pattern: /\bhealth(?:care)?\b|\bmedical\b/i,
		terms: ["healthcare", "medical", "clinical", "claim", "insurance"],
	},
	{
		pattern: /\blogistics?\b|\bsupply chain\b/i,
		terms: [
			"logistics",
			"warehouse",
			"vehicle routing",
			"vrp",
			"route optimization",
			"inventory",
			"truck",
			"field operations",
		],
	},
	{
		pattern: /\bidentity\b|\bdecentralized identity\b/i,
		terms: [
			"identity",
			"decentralized identity",
			"verifiable presentation",
			"zero knowledge",
			"zkp",
			"bbs",
			"anoncreds",
			"privacy",
		],
	},
];

function normalize(value: string): string {
	return String(value || "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/[^a-z0-9+#.]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function unique(values: string[]): string[] {
	const seen = new Set<string>();
	return values.filter((value) => {
		const key = normalize(value);
		if (!key || seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function queryTerms(query: string): string[] {
	const normalizedQuery = normalize(query);
	const terms: string[] = [];
	for (const expansion of QUERY_EXPANSIONS) {
		if (expansion.pattern.test(query)) terms.push(...expansion.terms);
	}
	for (const token of normalizedQuery.split(" ")) {
		if (token.length < 2 || STOP_WORDS.has(token) || GENERIC_TERMS.has(token)) {
			continue;
		}
		terms.push(token);
	}
	if (
		normalizedQuery.length > 2 &&
		!GENERIC_TERMS.has(normalizedQuery) &&
		!/^which |^show |^have |^what |^is |^compare /.test(normalizedQuery)
	) {
		terms.unshift(normalizedQuery);
	}
	return unique(terms.map(normalize));
}

function findExactValue(values: string[], term: string): string | undefined {
	return values.find((value) => normalize(value) === term);
}

function findContainingValue(
	values: string[],
	term: string,
): string | undefined {
	return values.find((value) => normalize(value).includes(term));
}

function rankProject(
	project: PortfolioKnowledgeProject,
	query: string,
	terms: string[],
): RankedProject {
	const normalizedQuery = normalize(query);
	const title = normalize(project.title);
	const description = normalize(project.description);
	const category = normalize(project.category);
	const content = normalize(project.searchableContent);
	const tags = project.tags || [];
	const technologies = project.technologies || [];
	const capabilities = project.capabilities || [];
	const domains = project.impactDomains || [];
	const problemLabels = (project.problems || []).map(
		(problem) => problem.label,
	);
	const reasons = new Set<string>();
	let score = 0;

	if (normalizedQuery === title) {
		score += 1_200;
		reasons.add("Exact project title match.");
	} else if (title.length >= 8 && normalizedQuery.includes(title)) {
		score += 900;
		reasons.add("The question names this project.");
	}

	for (const term of terms) {
		if (!term || GENERIC_TERMS.has(term)) continue;
		if (title.includes(term)) {
			score += 120;
			reasons.add(`Title matches ?${term}?.`);
		}

		const exactDomain = findExactValue(domains, term);
		const exactProblem = findExactValue(problemLabels, term);
		const exactTechnology = findExactValue(technologies, term);
		const exactTag = findExactValue(tags, term);
		const exactCapability = findExactValue(capabilities, term);
		if (exactDomain) {
			score += 420;
			reasons.add(`Mapped to the ${exactDomain} impact domain.`);
		} else if (exactProblem) {
			score += 390;
			reasons.add(`Addresses ${exactProblem}.`);
		} else if (exactTechnology) {
			score += 380;
			reasons.add(`Uses ${exactTechnology}.`);
		} else if (exactTag) {
			score += 350;
			reasons.add(`Tagged ${exactTag}.`);
		} else if (exactCapability) {
			score += 350;
			reasons.add(`Lists ${exactCapability} as a capability.`);
		} else {
			const domain = findContainingValue(domains, term);
			const problem = findContainingValue(problemLabels, term);
			const technology = findContainingValue(technologies, term);
			const tag = findContainingValue(tags, term);
			const capability = findContainingValue(capabilities, term);
			if (domain) {
				score += 170;
				reasons.add(`Mapped to the ${domain} impact domain.`);
			}
			if (problem) {
				score += 160;
				reasons.add(`Addresses ${problem}.`);
			}
			if (technology) {
				score += 150;
				reasons.add(`Uses ${technology}.`);
			}
			if (tag) {
				score += 140;
				reasons.add(`Tagged ${tag}.`);
			}
			if (capability) {
				score += 140;
				reasons.add(`Lists ${capability} as a capability.`);
			}
		}

		if (category === term || category.includes(term)) {
			score += category === term ? 120 : 65;
			reasons.add(`Category: ${project.category}.`);
		}
		if (description.includes(term)) {
			score += 48;
			reasons.add("The published description directly matches the question.");
		}
		if (content.includes(term)) {
			score += 8;
		}
	}

	return { project, score, reasons: [...reasons] };
}

export function searchPortfolio(
	index: PortfolioKnowledgeIndex,
	query: string,
	scopeIds?: string[],
): RankedProject[] {
	const allowed = scopeIds?.length ? new Set(scopeIds) : null;
	const terms = queryTerms(query);
	return index.projects
		.filter((project) => !allowed || allowed.has(project.id))
		.map((project) => rankProject(project, query, terms))
		.filter((match) => match.score >= 35)
		.sort((a, b) => {
			if (a.score !== b.score) return b.score - a.score;
			if (a.project.year !== b.project.year) {
				return b.project.year.localeCompare(a.project.year);
			}
			return a.project.title.localeCompare(b.project.title);
		});
}

function titleTokens(project: PortfolioKnowledgeProject): string[] {
	return normalize(`${project.title} ${project.slug}`)
		.split(" ")
		.filter(
			(token) =>
				token.length >= 2 &&
				!STOP_WORDS.has(token) &&
				!GENERIC_TERMS.has(token),
		);
}

function findProjectReference(
	index: PortfolioKnowledgeIndex,
	reference: string,
): PortfolioKnowledgeProject | undefined {
	const normalizedReference = normalize(reference);
	if (!normalizedReference) return undefined;
	const referenceTokens = normalizedReference
		.split(" ")
		.filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
	let best: { project: PortfolioKnowledgeProject; score: number } | undefined;

	for (const project of index.projects) {
		const normalizedTitle = normalize(project.title);
		let score = 0;
		if (
			normalizedTitle === normalizedReference ||
			normalizedTitle.includes(normalizedReference)
		) {
			score += 500;
		}
		const tokens = titleTokens(project);
		for (const token of referenceTokens) {
			if (tokens.includes(token)) score += token.length >= 5 ? 80 : 45;
		}
		if (!best || score > best.score) best = { project, score };
	}
	return best && best.score >= 45 ? best.project : undefined;
}

function currentProject(
	index: PortfolioKnowledgeIndex,
	currentSlug: string,
): PortfolioKnowledgeProject | undefined {
	const slug = normalize(currentSlug);
	return index.projects.find(
		(project) =>
			normalize(project.slug) === slug || normalize(project.id) === slug,
	);
}

function statusLabel(status: PortfolioDeploymentStatus): string {
	return {
		production: "Production deployment",
		prototype: "Prototype",
		research: "Research experiment",
		concept: "Concept",
		demo: "Demo",
		unspecified: "Deployment not specified",
	}[status];
}

function rankedReason(match: RankedProject): string {
	return (
		match.reasons.slice(0, 2).join(" ") ||
		match.project.description ||
		"Matches the published portfolio data."
	);
}

function collectTechnologies(projects: PortfolioKnowledgeProject[]): string[] {
	return unique(
		projects.flatMap((project) => project.technologies || []),
	).slice(0, 12);
}

function scopedProjects(
	index: PortfolioKnowledgeIndex,
	state: ConversationState,
	query: string,
): PortfolioKnowledgeProject[] | undefined {
	if (!/\b(those|these|them|previous|above)\b/i.test(query)) return undefined;
	if (!state.lastProjectIds.length) return undefined;
	const ids = new Set(state.lastProjectIds);
	return index.projects.filter((project) => ids.has(project.id));
}

function namedProjects(
	index: PortfolioKnowledgeIndex,
	query: string,
	current?: PortfolioKnowledgeProject,
): PortfolioKnowledgeProject[] {
	if (current && /\b(this|current) project\b/i.test(query)) return [current];
	const references = query
		.replace(/^.*?\bcompare\b/i, "")
		.split(/\b(?:and|versus|vs\.?|with)\b|,/i)
		.map((part) => part.replace(/\bprojects?\b/gi, "").trim())
		.filter(Boolean);
	const found = references
		.map((reference) => findProjectReference(index, reference))
		.filter((project): project is PortfolioKnowledgeProject =>
			Boolean(project),
		);
	return unique(found.map((project) => project.id))
		.map((id) => found.find((project) => project.id === id))
		.filter((project): project is PortfolioKnowledgeProject =>
			Boolean(project),
		);
}

function isPortfolioQuestion(
	query: string,
	ranked: RankedProject[],
	current?: PortfolioKnowledgeProject,
): boolean {
	if (current && /\b(this|current)\b/i.test(query)) return true;
	if (ranked.length > 0) return true;
	return /\b(projects?|portfolio|technolog(?:y|ies)|research|deploy(?:ed|ment|ments|ing)?|production|prototype|demo|github|paper|architecture|dataset|metric|result|accuracy|impact domain|problem|capabilit(?:y|ies)|compare)\b/i.test(
		query,
	);
}

function detailAnswer(
	projects: PortfolioKnowledgeProject[],
	kind: "dataset" | "results" | "architecture",
): AssistantAnswer {
	const available = projects.filter((project) => {
		if (kind === "dataset") return Boolean(project.datasetDetails);
		if (kind === "results") return Boolean(project.resultsAndMetrics);
		return project.architecture.available;
	});
	if (!available.length) return { lead: NO_INFORMATION, projects: [] };
	return {
		lead:
			kind === "dataset"
				? "Published dataset details are available for the following project(s)."
				: kind === "results"
					? "Published results or metrics are available for the following project(s)."
					: "Published architecture information is available for the following project(s).",
		projects: available.map((project) => ({
			project,
			reason:
				kind === "dataset"
					? project.datasetDetails
					: kind === "results"
						? project.resultsAndMetrics
						: project.architecture.details ||
							"The project includes an architecture section or asset.",
		})),
		technologies: collectTechnologies(available),
	};
}

function deploymentAnswer(
	projects: PortfolioKnowledgeProject[],
	productionOnly: boolean,
): AssistantAnswer {
	const selected = productionOnly
		? projects.filter((project) => project.deployment.status === "production")
		: projects;
	if (!selected.length) return { lead: NO_INFORMATION, projects: [] };
	return {
		lead: productionOnly
			? `Yes. I found ${selected.length} project${selected.length === 1 ? "" : "s"} with explicit production-deployment evidence in the published portfolio.`
			: "The published deployment classification is shown below.",
		projects: selected.map((project) => ({
			project,
			reason:
				project.deployment.details || statusLabel(project.deployment.status),
			evidence: project.deployment.evidence,
		})),
		technologies: collectTechnologies(selected),
	};
}

function similarProjects(
	index: PortfolioKnowledgeIndex,
	project: PortfolioKnowledgeProject,
): PortfolioKnowledgeProject[] {
	const byId = new Map(
		index.projects.map((candidate) => [candidate.id, candidate]),
	);
	const explicit = (project.relatedProjectIds || [])
		.map((id) => byId.get(id))
		.filter((candidate): candidate is PortfolioKnowledgeProject =>
			Boolean(candidate),
		);
	if (explicit.length) return explicit.slice(0, 5);
	const query = unique([
		...(project.impactDomains || []),
		...(project.technologies || []),
		...(project.tags || []),
	])
		.slice(0, 8)
		.join(" ");
	return searchPortfolio(index, query)
		.map((match) => match.project)
		.filter((candidate) => candidate.id !== project.id)
		.slice(0, 5);
}

export function answerPortfolioQuestion(
	index: PortfolioKnowledgeIndex,
	query: string,
	state: ConversationState,
	currentSlug = "",
): AssistantAnswer {
	const trimmed = query.trim();
	const current = currentProject(index, currentSlug);
	const scoped = scopedProjects(index, state, trimmed);
	const ranked = searchPortfolio(
		index,
		trimmed,
		scoped?.map((project) => project.id),
	);

	if (!isPortfolioQuestion(trimmed, ranked, current)) {
		return { lead: PORTFOLIO_REDIRECT, projects: [] };
	}

	if (/\bcompare\b|\bversus\b|\bvs\.?\b/i.test(trimmed)) {
		const compared = namedProjects(index, trimmed, current).slice(0, 2);
		if (compared.length < 2) {
			return { lead: NO_MATCH, projects: [], navigation: true };
		}
		return {
			lead: "Here is a portfolio-grounded comparison of the two published projects.",
			projects: compared.map((project) => ({
				project,
				reason: `${project.category}; ${statusLabel(project.deployment.status)}. ${project.description}`,
				evidence: project.deployment.evidence,
			})),
			technologies: collectTechnologies(compared),
		};
	}

	if (current && /\bexplain this project\b/i.test(trimmed)) {
		return {
			lead: "Here is the published summary for the current project.",
			projects: [{ project: current, reason: current.description }],
			technologies: collectTechnologies([current]),
		};
	}

	if (
		current &&
		/\bshow similar projects?\b|\bsimilar to this\b/i.test(trimmed)
	) {
		const similar = similarProjects(index, current);
		if (!similar.length)
			return { lead: NO_MATCH, projects: [], navigation: true };
		return {
			lead: "These projects have the strongest published domain, technology, tag or related-project overlap.",
			projects: similar.map((project) => ({
				project,
				reason: project.description,
			})),
			technologies: collectTechnologies(similar),
		};
	}
	if (/\bsimilar to\b/i.test(trimmed)) {
		const reference = findProjectReference(
			index,
			trimmed.replace(/^.*?\bsimilar to\b/i, ""),
		);
		if (reference) {
			const similar = similarProjects(index, reference);
			if (!similar.length)
				return { lead: NO_MATCH, projects: [], navigation: true };
			return {
				lead: "These projects have the strongest published domain, technology, tag or related-project overlap.",
				projects: similar.map((project) => ({
					project,
					reason: project.description,
				})),
				technologies: collectTechnologies(similar),
			};
		}
	}

	if (current && /\bwhat problem|\bproblem does this solve/i.test(trimmed)) {
		const reasons = current.problems.map((problem) => problem.label);
		return {
			lead: reasons.length
				? "The current project maps to the following published problem areas."
				: "The current project\u2019s published description provides the available problem context.",
			projects: [
				{
					project: current,
					reason: reasons.length
						? reasons.join("; ")
						: current.description || NO_INFORMATION,
				},
			],
			technologies: collectTechnologies([current]),
		};
	}

	const referenced = namedProjects(index, trimmed, current);
	const detailScope = scoped?.length
		? scoped
		: referenced.length
			? referenced
			: current
				? [current]
				: [];

	if (/\b(dataset|training data|data size|data source)\b/i.test(trimmed)) {
		return detailAnswer(
			detailScope.length ? detailScope : ranked.map((match) => match.project),
			"dataset",
		);
	}
	if (
		/\b(result|metric|accuracy|precision|recall|f1|latency|throughput)\b/i.test(
			trimmed,
		)
	) {
		return detailAnswer(
			detailScope.length ? detailScope : ranked.map((match) => match.project),
			"results",
		);
	}
	if (/\barchitecture|system design\b/i.test(trimmed)) {
		return detailAnswer(
			detailScope.length ? detailScope : ranked.map((match) => match.project),
			"architecture",
		);
	}

	if (
		/\b(deploy|deployed|deployment|production|live system|24\s*x\s*7)\b/i.test(
			trimmed,
		)
	) {
		const scope = scoped?.length
			? scoped
			: referenced.length
				? referenced
				: current
					? [current]
					: index.projects;
		const productionOnly =
			!current ||
			/\bproduction|which of those|which are deployed|have you deployed\b/i.test(
				trimmed,
			);
		return deploymentAnswer(scope, productionOnly);
	}

	if (/\btechnolog(?:y|ies)|tech stack\b/i.test(trimmed) && current) {
		if (!current.technologies.length) {
			return {
				lead: NO_INFORMATION,
				projects: [{ project: current, reason: current.description }],
			};
		}
		return {
			lead: "The current project lists the following technologies in its published portfolio data.",
			projects: [{ project: current, reason: current.description }],
			technologies: current.technologies,
		};
	}

	const availabilityKind: PortfolioActionKind | undefined =
		/\bgithub|repositories?\b/i.test(trimmed)
			? "github"
			: /\blive demos?|demo links?\b/i.test(trimmed)
				? "demo"
				: /\bpapers?|publications?\b/i.test(trimmed)
					? "paper"
					: /\bdocumentation|docs\b/i.test(trimmed)
						? "docs"
						: undefined;
	if (availabilityKind) {
		const available = index.projects.filter((project) =>
			project.actions.some((action) => action.kind === availabilityKind),
		);
		if (!available.length) return { lead: NO_INFORMATION, projects: [] };
		const label = {
			github: "GitHub repository",
			demo: "live demo",
			paper: "paper",
			docs: "documentation",
			video: "video",
		}[availabilityKind];
		return {
			lead: `I found ${available.length} published project${available.length === 1 ? "" : "s"} with an explicit ${label} link.`,
			projects: available.map((project) => ({
				project,
				reason: `The published portfolio includes an explicit ${label} URL.`,
			})),
			technologies: collectTechnologies(available),
		};
	}

	let results = ranked;
	if (
		/\bcomputer vision\b/i.test(trimmed) &&
		!/\bimpact domain\b/i.test(trimmed)
	) {
		results = results.filter((match) =>
			match.reasons.some((reason) =>
				/^(Uses|Tagged|Title|The published description|Lists)/.test(reason),
			),
		);
	}
	if (/\bresearch\b/i.test(trimmed)) {
		const researchResults = results.filter((match) =>
			/\bresearch|experiment|benchmark\b/i.test(
				`${match.project.category} ${match.project.description} ${match.project.searchableContent}`,
			),
		);
		if (researchResults.length) results = researchResults;
	}
	if (!results.length)
		return { lead: NO_MATCH, projects: [], navigation: true };

	const recommendation = /\bmost relevant|\bbest match|\brecommend/i.test(
		trimmed,
	);
	const selected = results.slice(0, recommendation ? 3 : 6);
	return {
		lead: recommendation
			? "The strongest deterministic portfolio match is shown first, followed by closely related published projects."
			: `I found ${selected.length} relevant published project${selected.length === 1 ? "" : "s"}.`,
		projects: selected.map((match) => ({
			project: match.project,
			reason: rankedReason(match),
		})),
		technologies: collectTechnologies(selected.map((match) => match.project)),
	};
}

function element<K extends keyof HTMLElementTagNameMap>(
	tagName: K,
	className?: string,
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tagName);
	if (className) node.className = className;
	return node;
}

function appendText(
	parent: HTMLElement,
	tag: "p" | "span" | "strong" | "h3" | "h4",
	text: string,
	className?: string,
): HTMLElement {
	const node = element(tag, className);
	node.textContent = text;
	parent.append(node);
	return node;
}

function externalLink(anchor: HTMLAnchorElement, href: string): void {
	if (/^https?:\/\//i.test(href)) {
		anchor.target = "_blank";
		anchor.rel = "noopener noreferrer";
	}
}

function renderProjectCard(
	answerProject: AnswerProject,
	index: PortfolioKnowledgeIndex,
): HTMLElement {
	const { project, reason, evidence = [] } = answerProject;
	const card = element("article", "project-intelligence-project-card");
	const heading = element("h4");
	const title = element("a");
	title.href = project.url;
	title.textContent = project.title;
	title.setAttribute("aria-label", `View project: ${project.title}`);
	heading.append(title);
	card.append(heading);

	const meta = element("div", "project-intelligence-project-meta");
	appendText(meta, "span", project.category);
	appendText(meta, "span", project.year);
	appendText(
		meta,
		"span",
		statusLabel(project.deployment.status),
		`project-intelligence-status is-${project.deployment.status}`,
	);
	card.append(meta);
	appendText(card, "p", reason, "project-intelligence-match-reason");

	if (evidence.length) {
		const evidenceBox = element("div", "project-intelligence-evidence");
		appendText(evidenceBox, "strong", "Published evidence");
		appendText(evidenceBox, "p", evidence.slice(0, 2).join(" "));
		card.append(evidenceBox);
	}

	const projectTechnologies = unique(project.technologies || []).slice(0, 7);
	if (projectTechnologies.length) {
		const chips = element("div", "project-intelligence-card-chips");
		chips.setAttribute("aria-label", `${project.title} technologies`);
		for (const technology of projectTechnologies) {
			appendText(chips, "span", technology);
		}
		card.append(chips);
	}

	const actions = element("div", "project-intelligence-actions");
	actions.setAttribute("aria-label", `Available links for ${project.title}`);
	const viewProject = element("a", "project-intelligence-primary-action");
	viewProject.href = project.url;
	viewProject.textContent = "View Project";
	viewProject.setAttribute("aria-label", `View project: ${project.title}`);
	actions.append(viewProject);

	const actionLabels: Partial<Record<PortfolioActionKind, string>> = {
		github: "Open GitHub",
		demo: "Open Demo",
		paper: "Open Paper",
		docs: "Documentation",
		pdf: "Open PDF",
	};
	for (const action of project.actions || []) {
		const label = actionLabels[action.kind];
		if (!label) continue;
		const anchor = element("a");
		anchor.href = action.url;
		anchor.textContent = label;
		anchor.setAttribute("aria-label", `${label} for ${project.title}`);
		externalLink(anchor, action.url);
		actions.append(anchor);
	}
	if (project.architecture.available && project.architecture.url) {
		const architecture = element("a");
		architecture.href = project.architecture.url;
		architecture.textContent = "View Architecture";
		architecture.setAttribute(
			"aria-label",
			`View architecture for ${project.title}`,
		);
		actions.append(architecture);
	}
	if (project.impactDomains.length) {
		const impact = element("a");
		impact.href = index.links.impactDomain;
		impact.textContent = "Explore Impact Domain";
		impact.setAttribute(
			"aria-label",
			`Explore impact domains related to ${project.title}`,
		);
		actions.append(impact);
	}
	if (project.relatedProjectIds.length) {
		const similar = element("button");
		similar.type = "button";
		similar.textContent = "Show Similar Projects";
		similar.dataset.projectIntelligenceQuery = `Show projects similar to ${project.title}`;
		actions.append(similar);
	}
	card.append(actions);
	return card;
}

function renderAnswer(
	container: HTMLElement,
	answer: AssistantAnswer,
	index: PortfolioKnowledgeIndex,
): HTMLElement {
	const message = element(
		"article",
		"project-intelligence-message is-assistant",
	);
	message.setAttribute("aria-label", "Project Intelligence answer");
	appendText(message, "p", answer.lead, "project-intelligence-answer-lead");

	if (answer.projects.length) {
		appendText(message, "h3", "Relevant projects");
		const list = element("ol", "project-intelligence-project-list");
		for (const answerProject of answer.projects) {
			const item = element("li");
			item.append(renderProjectCard(answerProject, index));
			list.append(item);
		}
		message.append(list);
	}

	if (answer.technologies?.length) {
		const section = element("section", "project-intelligence-technologies");
		appendText(section, "h3", "Technologies");
		const chips = element("div");
		for (const technology of answer.technologies) {
			appendText(chips, "span", technology);
		}
		section.append(chips);
		message.append(section);
	}

	if (answer.navigation) {
		const navigation = element("nav", "project-intelligence-navigation");
		navigation.setAttribute("aria-label", "Explore the published portfolio");
		const links = [
			["Browse all projects", index.links.allProjects],
			["Choose a Problem", index.links.chooseProblem],
			["Search Impact Domain", index.links.impactDomain],
		];
		for (const [label, href] of links) {
			const anchor = element("a");
			anchor.textContent = label;
			anchor.href = href;
			navigation.append(anchor);
		}
		message.append(navigation);
	}
	container.append(message);
	return message;
}

function renderQuickSearchNotice(
	message: HTMLElement,
	label = "Quick portfolio search",
): HTMLElement {
	const notice = element("span", "project-intelligence-mode-note");
	notice.textContent = label;
	message.prepend(notice);
	return notice;
}

function renderRagAnswer(
	container: HTMLElement,
	answer: RagAnswer,
	modeLabel = "",
): HTMLElement {
	const message = element(
		"article",
		"project-intelligence-message is-assistant is-rag-answer",
	);
	message.setAttribute("aria-label", "Project Intelligence answer");
	if (modeLabel) renderQuickSearchNotice(message, modeLabel);
	appendText(message, "h3", "Answer");
	appendText(message, "p", answer.answer, "project-intelligence-answer-lead");

	const sources = answer.sources.filter(
		(source, index, items) =>
			source.url &&
			items.findIndex(
				(candidate) => candidate.source_id === source.source_id,
			) === index,
	);
	if (sources.length) {
		appendText(message, "h3", "Sources");
		const sourceList = element("nav", "project-intelligence-sources");
		sourceList.setAttribute("aria-label", "Sources for this answer");
		for (const source of sources) {
			const anchor = element("a");
			anchor.href = source.url;
			anchor.textContent = source.section
				? `${source.project_title} Â· ${source.section}`
				: source.project_title;
			anchor.textContent = source.section
				? `${source.project_title} · ${source.section}`
				: source.project_title;
			anchor.setAttribute(
				"aria-label",
				`Open source: ${source.project_title}, ${source.section}`,
			);
			sourceList.append(anchor);
		}
		message.append(sourceList);
	}

	const related = answer.related_projects.filter(
		(project, index, items) =>
			project.url &&
			items.findIndex((candidate) => candidate.id === project.id) === index,
	);
	if (related.length) {
		appendText(message, "h3", "Related projects");
		const relatedList = element("nav", "project-intelligence-related");
		relatedList.setAttribute("aria-label", "Related projects");
		for (const project of related) {
			const anchor = element("a");
			anchor.href = project.url;
			anchor.textContent = project.title;
			relatedList.append(anchor);
		}
		message.append(relatedList);
	}
	container.append(message);
	return message;
}

function renderAiStatus(
	container: HTMLElement,
	initialStatus: string,
	onCancel: () => void,
): {
	element: HTMLElement;
	setStatus: (status: string) => void;
} {
	const message = element(
		"article",
		"project-intelligence-message is-assistant is-loading project-intelligence-ai-status",
	);
	message.setAttribute("aria-label", "Project Intelligence local AI status");
	const row = element("div", "project-intelligence-ai-status-row");
	const status = appendText(
		row,
		"p",
		initialStatus,
		"project-intelligence-loading-status",
	);
	const cancel = element("button", "project-intelligence-cancel");
	cancel.type = "button";
	cancel.textContent = "Cancel";
	cancel.addEventListener("click", onCancel, { once: true });
	row.append(cancel);
	message.append(row);
	container.append(message);
	return {
		element: message,
		setStatus(value: string) {
			status.textContent = value;
		},
	};
}

function appendAiDetail(message: HTMLElement, value: string): void {
	appendText(message, "p", value, "project-intelligence-ai-detail");
}

function localModelDownloadPercentage(
	progress?: BrowserAiProgress,
): number | null {
	if (!progress || progress.stage !== "llm-model") return null;
	if (
		progress.totalKnown === true &&
		typeof progress.progress === "number" &&
		Number.isFinite(progress.progress)
	) {
		return Math.round(Math.min(Math.max(progress.progress, 0), 100));
	}
	if (
		progress.totalKnown === true &&
		typeof progress.loaded === "number" &&
		typeof progress.total === "number" &&
		progress.total > 0
	) {
		return Math.round(
			Math.min(Math.max((progress.loaded / progress.total) * 100, 0), 100),
		);
	}
	return null;
}

function localModelDownloadedBytes(progress?: BrowserAiProgress): string {
	if (
		!progress ||
		progress.stage !== "llm-model" ||
		typeof progress.loaded !== "number" ||
		!Number.isFinite(progress.loaded) ||
		progress.loaded <= 0
	) {
		return "";
	}
	const formatMegabytes = (bytes: number) => {
		const megabytes = bytes / 1_000_000;
		return megabytes >= 100
			? Math.round(megabytes).toLocaleString()
			: megabytes.toFixed(1);
	};
	if (
		progress.totalKnown === true &&
		typeof progress.total === "number" &&
		Number.isFinite(progress.total) &&
		progress.total > 0
	) {
		return `Downloaded ${formatMegabytes(progress.loaded)} MB / ${formatMegabytes(progress.total)} MB`;
	}
	return `Downloaded ${formatMegabytes(progress.loaded)} MB`;
}

function localGenerationDetail(progress?: BrowserAiProgress): string {
	if (
		!progress ||
		progress.stage !== "generation" ||
		progress.status !== "complete"
	) {
		return "";
	}
	const parts: string[] = [];
	if (typeof progress.tokensGenerated === "number") {
		parts.push(
			`Generated ${progress.tokensGenerated} token${progress.tokensGenerated === 1 ? "" : "s"}`,
		);
	}
	if (typeof progress.generationTotalMs === "number") {
		parts.push(`total ${(progress.generationTotalMs / 1_000).toFixed(1)}s`);
	}
	if (typeof progress.firstTokenLatencyMs === "number") {
		parts.push(
			`first token ${(progress.firstTokenLatencyMs / 1_000).toFixed(1)}s`,
		);
	}
	if (typeof progress.tokensPerSecond === "number") {
		parts.push(`${progress.tokensPerSecond.toFixed(2)} tokens/sec`);
	}
	return parts.join(" · ");
}

function localModelStatus(snapshot: BrowserLocalLlmSnapshot): string {
	if (snapshot.state === "loading") {
		if (snapshot.progress?.stage === "model-init") {
			return "Initializing WebGPU…";
		}
		const percentage = localModelDownloadPercentage(snapshot.progress);
		return percentage === null
			? "Downloading local AI model…"
			: `Downloading local AI model — ${percentage}%`;
	}
	if (snapshot.state === "ready") return "Local AI ready";
	if (snapshot.state === "stale") {
		return "Local AI will reinitialize from cache when requested.";
	}
	if (snapshot.state === "generating") {
		if (snapshot.progress?.status === "cancelling") {
			return "Cancelling generation…";
		}
		if (
			typeof snapshot.progress?.tokensGenerated === "number" &&
			snapshot.progress.tokensGenerated > 0
		) {
			const tokens = snapshot.progress.tokensGenerated;
			return `Generating deeper explanation… ${tokens} token${tokens === 1 ? "" : "s"}`;
		}
		if (snapshot.progress?.firstGeneration) {
			return "Preparing WebGPU for first generation…";
		}
		return "Generating deeper explanation…";
	}
	if (snapshot.state === "failed") return LOCAL_AI_FAILURE_NOTICE;
	return "";
}

async function renderLocalAiAction(options: {
	message: HTMLElement;
	question: string;
	retrieval: BrowserRagAnswer;
	lifecycleSignal: AbortSignal;
	onComplete?: () => void;
}): Promise<void> {
	const localAi = await import("./project-intelligence/browser-llm");
	const controls = element("section", "project-intelligence-local-ai");
	controls.setAttribute("aria-label", "Optional local AI explanation");
	const modelName = localAi.BROWSER_LLM_MODEL.split("/").at(-1);
	const diagnostic = appendText(
		controls,
		"p",
		`Local model: ${modelName} · ${localAi.BROWSER_LLM_DTYPE} · ${localAi.BROWSER_LLM_DEVICE}`,
		"project-intelligence-local-ai-model",
	);
	const button = element("button", "project-intelligence-local-ai-button");
	button.type = "button";
	button.dataset.projectIntelligenceLocalAi = "";
	button.textContent = "Generate deeper local AI explanation";
	const cancelButton = element(
		"button",
		"project-intelligence-cancel project-intelligence-local-ai-cancel",
	);
	cancelButton.type = "button";
	cancelButton.textContent = "Cancel";
	cancelButton.hidden = true;
	const status = appendText(
		controls,
		"p",
		"",
		"project-intelligence-local-ai-status",
	);
	status.setAttribute("aria-live", "polite");
	const downloadDetail = appendText(
		controls,
		"p",
		"",
		"project-intelligence-local-ai-download-detail",
	);
	controls.prepend(diagnostic, button, cancelButton);
	options.message.append(controls);

	let completed = false;
	let customReadyMessage = "";
	const renderSnapshot = (snapshot: BrowserLocalLlmSnapshot) => {
		controls.dataset.localAiState = snapshot.state;
		button.disabled = completed || snapshot.state === "generating";
		button.hidden =
			completed ||
			snapshot.state === "loading" ||
			snapshot.state === "generating" ||
			snapshot.state === "failed";
		cancelButton.hidden = !["loading", "generating"].includes(snapshot.state);
		cancelButton.disabled = snapshot.progress?.status === "cancelling";
		const value =
			snapshot.state === "ready" && customReadyMessage
				? customReadyMessage
				: localModelStatus(snapshot);
		status.textContent = value;
		status.hidden = !value;
		const detail =
			snapshot.state === "loading"
				? localModelDownloadedBytes(snapshot.progress)
				: localGenerationDetail(snapshot.progress);
		downloadDetail.textContent = detail;
		downloadDetail.hidden = !detail;
		if (
			snapshot.progress?.stage === "generation" &&
			snapshot.progress.status === "complete"
		) {
			controls.dataset.generationFirstTokenMs = String(
				snapshot.progress.firstTokenLatencyMs ?? "",
			);
			controls.dataset.generationTotalMs = String(
				snapshot.progress.generationTotalMs ?? "",
			);
			controls.dataset.generationTokens = String(
				snapshot.progress.tokensGenerated ?? "",
			);
			controls.dataset.generationTokensPerSecond = String(
				snapshot.progress.tokensPerSecond ?? "",
			);
		}
	};
	const unsubscribe = localAi.subscribeLocalBrowserModel(renderSnapshot);
	options.lifecycleSignal.addEventListener("abort", unsubscribe, {
		once: true,
	});
	cancelButton.addEventListener("click", () => {
		localAi.cancelLocalBrowserModel();
	});

	button.addEventListener("click", async () => {
		customReadyMessage = "";
		delete controls.dataset.localAiValidationReason;
		try {
			await localAi.initializeLocalBrowserModel();
			await new Promise<void>((resolve) =>
				window.requestAnimationFrame(() => resolve()),
			);
			const enhanced = await localAi.generateLocalBrowserAnswer({
				question: options.question,
				retrieval: options.retrieval,
			});
			if (!enhanced) {
				const validationReason =
					localAi.getLastLocalBrowserValidationReason?.();
				if (validationReason) {
					controls.dataset.localAiValidationReason = validationReason;
				}
				customReadyMessage =
					"The local model did not return a grounded explanation. The grounded portfolio answer remains above.";
				renderSnapshot(localAi.getLocalBrowserModelState());
				return;
			}

			completed = true;
			const explanation = element(
				"section",
				"project-intelligence-local-ai-explanation",
			);
			appendText(explanation, "h3", "Local AI explanation");
			appendText(
				explanation,
				"p",
				enhanced.answer,
				"project-intelligence-local-ai-answer",
			);
			appendText(
				explanation,
				"p",
				"Generated on this device from the grounded portfolio sources above.",
				"project-intelligence-ai-detail",
			);
			const evidenceCandidates = enhanced.sources
				.map((source, index) => {
					const matchingHits = enhanced.context.filter(
						(hit) =>
							hit.chunk.project_id === source.project_id &&
							hit.chunk.section === source.section,
					);
					return {
						source,
						index,
						score: Math.max(0, ...matchingHits.map((hit) => hit.hybridScore)),
					};
				})
				.sort(
					(left, right) => right.score - left.score || left.index - right.index,
				);
			const seenSourceIds = new Set<string>();
			const projectCounts = new Map<string, number>();
			const trustedEvidence: typeof enhanced.sources = [];
			for (const candidate of evidenceCandidates) {
				const sourceId = candidate.source.source_id.trim().toUpperCase();
				if (seenSourceIds.has(sourceId)) continue;
				const projectCount =
					projectCounts.get(candidate.source.project_id) ?? 0;
				if (projectCount >= 2) continue;
				seenSourceIds.add(sourceId);
				projectCounts.set(candidate.source.project_id, projectCount + 1);
				trustedEvidence.push(candidate.source);
				if (trustedEvidence.length === 4) break;
			}
			if (trustedEvidence.length) {
				const evidenceSection = element(
					"section",
					"project-intelligence-local-ai-evidence",
				);
				appendText(evidenceSection, "h4", "Evidence supplied to local AI");
				const evidenceList = element(
					"nav",
					"project-intelligence-sources project-intelligence-local-ai-evidence-list",
				);
				evidenceList.setAttribute(
					"aria-label",
					"Trusted evidence supplied to the local AI explanation",
				);
				for (const source of trustedEvidence) {
					const chip = element("a");
					chip.href = source.url;
					chip.textContent = source.section
						? `${source.project_title} · ${source.section}`
						: source.project_title;
					chip.setAttribute(
						"aria-label",
						`Open evidence: ${source.project_title}, ${source.section}`,
					);
					evidenceList.append(chip);
				}
				evidenceSection.append(evidenceList);
				explanation.append(evidenceSection);
			}
			controls.before(explanation);
			customReadyMessage = "";
			renderSnapshot(localAi.getLocalBrowserModelState());
			options.onComplete?.();
		} catch (error) {
			const snapshot = localAi.getLocalBrowserModelState();
			if (error instanceof Error && error.name === "AbortError") {
				customReadyMessage = "Generation cancelled. Local AI remains ready.";
			} else if (snapshot.state !== "failed") {
				customReadyMessage =
					"The local explanation was unavailable. The grounded portfolio answer remains above.";
			}
			renderSnapshot(snapshot);
		}
	});
}

function progressLabel(prefix: string, progress: BrowserAiProgress): string {
	const percentage = progress.progress;
	if (typeof percentage === "number" && Number.isFinite(percentage)) {
		const normalized = percentage <= 1 ? percentage * 100 : percentage;
		return `${prefix} ${Math.round(Math.min(Math.max(normalized, 0), 100))}%`;
	}
	return prefix;
}

function renderLoadingMessage(container: HTMLElement): {
	element: HTMLElement;
	setStatus: (status: string) => void;
} {
	const message = element(
		"article",
		"project-intelligence-message is-assistant is-loading",
	);
	message.setAttribute("aria-label", "Project Intelligence is working");
	const status = appendText(
		message,
		"p",
		"Searching my project portfolioâ€¦",
		"project-intelligence-loading-status",
	);
	status.textContent = "Searching my project portfolio…";
	container.append(message);
	return {
		element: message,
		setStatus(value: string) {
			status.textContent = value;
		},
	};
}

function isRagAnswer(value: unknown): value is RagAnswer {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Partial<RagAnswer>;
	return (
		typeof candidate.answer === "string" &&
		candidate.answer.trim().length > 0 &&
		Array.isArray(candidate.sources) &&
		Array.isArray(candidate.related_projects)
	);
}

async function requestRagAnswer(
	index: PortfolioKnowledgeIndex,
	query: string,
	conversation: RagConversationTurn[],
	currentProjectId = "",
): Promise<RagAnswer> {
	if (!PROJECT_AI_API_URL) throw new Error("Project AI API is not configured");
	const controller = new AbortController();
	const timeout = window.setTimeout(
		() => controller.abort(),
		PROJECT_AI_TIMEOUT_MS,
	);
	try {
		const lexicalMatches = searchPortfolio(index, query)
			.slice(0, 12)
			.map((match) => ({
				project_id: match.project.id,
				score: Math.min(Math.max(match.score, 0), 5_000),
				reasons: match.reasons.slice(0, 5),
			}));
		const response = await fetch(`${PROJECT_AI_API_URL}/ask`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			signal: controller.signal,
			body: JSON.stringify({
				question: query,
				conversation: conversation.slice(-6),
				lexical_matches: lexicalMatches,
				current_project_id: currentProjectId || null,
			}),
		});
		if (!response.ok) throw new Error("Project AI API request failed");
		const answer: unknown = await response.json();
		if (!isRagAnswer(answer)) {
			throw new Error("Project AI API returned an invalid answer");
		}
		return answer;
	} finally {
		window.clearTimeout(timeout);
	}
}

function renderUserMessage(container: HTMLElement, query: string): void {
	const message = element("article", "project-intelligence-message is-user");
	message.setAttribute("aria-label", "Your question");
	appendText(message, "p", query);
	container.append(message);
}

export function mountProjectIntelligence(
	root: HTMLElement,
): ProjectIntelligenceController {
	activeProjectIntelligenceController?.destroy();
	const trigger = root.querySelector<HTMLButtonElement>(
		"[data-project-intelligence-trigger]",
	);
	const layer = root.querySelector<HTMLElement>(
		"[data-project-intelligence-layer]",
	);
	const dialog = root.querySelector<HTMLElement>(
		"[data-project-intelligence-dialog]",
	);
	const form = root.querySelector<HTMLFormElement>(
		"[data-project-intelligence-form]",
	);
	const input = root.querySelector<HTMLInputElement>(
		"[data-project-intelligence-input]",
	);
	const body = root.querySelector<HTMLElement>(
		"[data-project-intelligence-body]",
	);
	const messages = root.querySelector<HTMLElement>(
		"[data-project-intelligence-messages]",
	);
	const live = root.querySelector<HTMLElement>(
		"[data-project-intelligence-live]",
	);
	const suggestions = root.querySelector<HTMLElement>(
		"[data-project-intelligence-suggestions]",
	);
	const closeButtons = [
		...root.querySelectorAll<HTMLButtonElement>(
			"[data-project-intelligence-close]",
		),
	];
	const abortController = new AbortController();
	let destroyed = false;
	let closeTimer: number | null = null;
	const state: ConversationState = { lastProjectIds: [], turns: [] };
	let activeProjectSlug = root.dataset.currentProjectSlug || "";
	let previouslyFocused: HTMLElement | null = null;
	let indexPromise: Promise<PortfolioKnowledgeIndex> | null = null;
	let activeAiOperation: AbortController | null = null;
	const browserAssetUrls: BrowserAssetUrls = {
		chunks: root.dataset.browserChunksUrl || "",
		vectorMetadata: root.dataset.browserVectorMetadataUrl || "",
		vectors: root.dataset.browserVectorsUrl || "",
	};
	if (layer) {
		// Escape the transformed, overflow-clipped Swup grid so fixed positioning
		// and the overlay z-index are relative to the viewport.
		layer.dataset.projectIntelligencePortal = "";
		document.body.append(layer);
	}

	const loadIndex = () => {
		if (!indexPromise) {
			indexPromise = fetch(root.dataset.indexUrl || "")
				.then((response) => {
					if (!response.ok) throw new Error("Portfolio index unavailable");
					return response.json() as Promise<PortfolioKnowledgeIndex>;
				})
				.catch((error) => {
					indexPromise = null;
					throw error;
				});
		}
		return indexPromise;
	};

	const close = (options: { immediate?: boolean } = {}) => {
		if (!layer || !dialog) return;
		const wasOpen = layer.dataset.open === "true";
		if (wasOpen) activeAiOperation?.abort();
		layer.dataset.open = "false";
		root.dataset.open = "false";
		layer.setAttribute("aria-hidden", "true");
		layer.inert = true;
		dialog.setAttribute("aria-hidden", "true");
		trigger?.setAttribute("aria-expanded", "false");
		document.documentElement.classList.remove("project-intelligence-open");
		if (closeTimer !== null) window.clearTimeout(closeTimer);
		if (options.immediate || layer.hidden) {
			layer.hidden = true;
			closeTimer = null;
		} else {
			closeTimer = window.setTimeout(() => {
				if (layer.dataset.open !== "true") layer.hidden = true;
				closeTimer = null;
			}, PANEL_TRANSITION_MS);
		}
		if (wasOpen && previouslyFocused?.isConnected) {
			previouslyFocused.focus({ preventScroll: true });
		}
	};

	const open = () => {
		if (!layer || !dialog || destroyed) return;
		if (closeTimer !== null) {
			window.clearTimeout(closeTimer);
			closeTimer = null;
		}
		previouslyFocused =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: trigger;
		layer.hidden = false;
		layer.dataset.open = "false";
		root.dataset.open = "false";
		layer.setAttribute("aria-hidden", "false");
		layer.inert = false;
		dialog.setAttribute("aria-hidden", "false");
		trigger?.setAttribute("aria-expanded", "true");
		document.documentElement.classList.add("project-intelligence-open");
		void layer.offsetWidth;
		layer.dataset.open = "true";
		root.dataset.open = "true";
		void loadIndex();
		if (suggestions) suggestions.hidden = false;
		input?.focus({ preventScroll: true });
	};

	const submitQuestion = async (question: string) => {
		const query = question.trim();
		if (!query || !messages || !form || !input) return;
		activeAiOperation?.abort();
		const operation = new AbortController();
		activeAiOperation = operation;
		const priorConversation = state.turns.slice(-6);
		renderUserMessage(messages, query);
		input.value = "";
		input.disabled = true;
		form.setAttribute("aria-busy", "true");
		if (suggestions) suggestions.hidden = true;
		const backendLoading = PROJECT_AI_API_URL
			? renderLoadingMessage(messages)
			: null;
		const progressTimers: number[] = [];

		const rememberRagAnswer = (answer: RagAnswer) => {
			state.lastProjectIds = unique([
				...(answer.retrieval.project_ids || []),
				...answer.sources.map((source) => source.project_id),
				...answer.related_projects.map((project) => project.id),
			]);
			state.turns = [
				...priorConversation,
				{ role: "user", content: query } as RagConversationTurn,
				{ role: "assistant", content: answer.answer } as RagConversationTurn,
			].slice(-6);
			if (live) live.textContent = answer.answer;
		};

		try {
			const index = await loadIndex();
			const activeProject = currentProject(index, activeProjectSlug);

			if (PROJECT_AI_API_URL && backendLoading) {
				progressTimers.push(
					window.setTimeout(
						() => backendLoading.setStatus("Reading relevant projects…"),
						2_500,
					),
					window.setTimeout(
						() => backendLoading.setStatus("Preparing a grounded answer…"),
						6_000,
					),
				);
				try {
					const ragAnswer = await requestRagAnswer(
						index,
						query,
						priorConversation,
						activeProject?.id || "",
					);
					backendLoading.element.remove();
					renderRagAnswer(messages, ragAnswer, "Self-hosted RAG");
					rememberRagAnswer(ragAnswer);
					return;
				} catch {
					backendLoading.element.remove();
				}
			}

			const quickAnswer = answerPortfolioQuestion(
				index,
				query,
				state,
				activeProjectSlug,
			);
			const quickMessage = renderAnswer(messages, quickAnswer, index);
			const quickNotice = renderQuickSearchNotice(
				quickMessage,
				"Quick result · preparing semantic search",
			);
			if (quickAnswer.projects.length) {
				state.lastProjectIds = quickAnswer.projects.map(
					(answerProject) => answerProject.project.id,
				);
			}
			state.turns = [
				...priorConversation,
				{ role: "user", content: query } as RagConversationTurn,
				{
					role: "assistant",
					content: [
						quickAnswer.lead,
						...quickAnswer.projects.map(
							(answerProject) => answerProject.project.title,
						),
					]
						.join(" ")
						.slice(0, 4_000),
				} as RagConversationTurn,
			].slice(-6);
			if (live) live.textContent = quickAnswer.lead;

			const semanticStatus = renderAiStatus(
				messages,
				"Preparing semantic search…",
				() => operation.abort(),
			);
			try {
				if (
					!browserAssetUrls.chunks ||
					!browserAssetUrls.vectorMetadata ||
					!browserAssetUrls.vectors
				) {
					throw new Error("Browser RAG asset URLs are missing");
				}
				const [{ detectBrowserAiCapabilities }, { retrieveBrowserRag }] =
					await Promise.all([
						import("./project-intelligence/browser-ai-capabilities"),
						import("./project-intelligence/browser-rag"),
					]);
				const capabilities = await detectBrowserAiCapabilities();
				if (!capabilities.semanticSearch) {
					throw new Error("Browser semantic search is unsupported");
				}
				const browserAnswer = await retrieveBrowserRag({
					question: query,
					assetUrls: browserAssetUrls,
					lexicalHints: searchPortfolio(index, query)
						.slice(0, 12)
						.map((match) => ({
							project_id: match.project.id,
							score: Math.min(Math.max(match.score, 0), 5_000),
							reasons: match.reasons.slice(0, 5),
						})),
					currentProjectId: activeProject?.id || "",
					signal: operation.signal,
					onProgress: (progress) => {
						semanticStatus.setStatus(
							progressLabel("Preparing semantic search…", progress),
						);
					},
				});
				if (operation.signal.aborted) {
					throw new DOMException("Aborted", "AbortError");
				}
				semanticStatus.element.remove();
				quickMessage.remove();
				const ragMessage = renderRagAnswer(
					messages,
					browserAnswer,
					"Browser-local RAG",
				);
				rememberRagAnswer(browserAnswer);
				if (live) live.textContent = "Found relevant projects.";

				if (
					!capabilities.localLlm ||
					!browserAnswer.context.length ||
					browserAnswer.sources.length === 0
				) {
					appendAiDetail(ragMessage, capabilities.reason);
					return;
				}

				try {
					await renderLocalAiAction({
						message: ragMessage,
						question: query,
						retrieval: browserAnswer,
						lifecycleSignal: abortController.signal,
						onComplete: () => {
							if (live) live.textContent = "Local AI explanation ready.";
						},
					});
				} catch {
					appendAiDetail(ragMessage, LOCAL_AI_FAILURE_NOTICE);
				}
				return;
			} catch {
				semanticStatus.element.remove();
				quickNotice.textContent = "Quick portfolio search";
				if (!operation.signal.aborted) {
					appendAiDetail(
						quickMessage,
						"Semantic search was unavailable; the deterministic portfolio result is shown.",
					);
				}
			}
		} catch {
			backendLoading?.element.remove();
			const errorMessage = element(
				"article",
				"project-intelligence-message is-assistant",
			);
			appendText(
				errorMessage,
				"p",
				"I couldn't search the portfolio right now. You can still browse the projects directly.",
			);
			messages.append(errorMessage);
			if (live) {
				live.textContent =
					"I couldn't search the portfolio right now. You can still browse the projects directly.";
			}
		} finally {
			for (const timer of progressTimers) window.clearTimeout(timer);
			if (activeAiOperation === operation) activeAiOperation = null;
			input.disabled = false;
			form.removeAttribute("aria-busy");
			input.focus({ preventScroll: true });
			body?.scrollTo({ top: body.scrollHeight, behavior: "smooth" });
		}
	};
	const ask = (question: string, projectSlug = "") => {
		activeProjectSlug = projectSlug || root.dataset.currentProjectSlug || "";
		open();
		void submitQuestion(question);
	};

	for (const button of closeButtons) {
		button.addEventListener("click", () => close(), {
			signal: abortController.signal,
		});
	}
	form?.addEventListener(
		"submit",
		(event) => {
			event.preventDefault();
			if (input) ask(input.value);
		},
		{ signal: abortController.signal },
	);
	layer?.addEventListener(
		"click",
		(event) => {
			const target =
				event.target instanceof Element
					? event.target.closest<HTMLElement>(
							"[data-project-intelligence-suggestion], [data-project-intelligence-query]",
						)
					: null;
			if (!target) return;
			const question =
				target.dataset.projectIntelligenceQuery || target.textContent || "";
			ask(question);
		},
		{ signal: abortController.signal },
	);

	document.addEventListener(
		"keydown",
		(event) => {
			if (!layer || layer.hidden || !dialog) return;
			if (event.key === "Escape") {
				event.preventDefault();
				close();
				return;
			}
			if (event.key !== "Tab") return;
			const focusable = [
				...dialog.querySelectorAll<HTMLElement>(
					'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
				),
			].filter((node) => !node.closest("[hidden]"));
			if (!focusable.length) return;
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		},
		{ signal: abortController.signal },
	);

	const controller: ProjectIntelligenceController = {
		open,
		ask,
		destroy() {
			if (destroyed) return;
			activeAiOperation?.abort();
			close({ immediate: true });
			destroyed = true;
			abortController.abort();
			layer?.remove();
			if (activeProjectIntelligenceController === controller) {
				activeProjectIntelligenceController = null;
			}
		},
	};
	activeProjectIntelligenceController = controller;
	return controller;
}
