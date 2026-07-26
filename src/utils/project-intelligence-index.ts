import type { CollectionEntry } from "astro:content";
import { buildProjectImpactGraphData } from "./project-impact-data";
import {
	buildProjectProblemExplorerData,
	toFilterKey,
} from "./project-problem-matching";
import { url } from "./url-utils";

export type PortfolioActionKind =
	| "github"
	| "demo"
	| "paper"
	| "docs"
	| "video";

export interface PortfolioAction {
	kind: PortfolioActionKind;
	label: string;
	url: string;
}

export type PortfolioDeploymentStatus =
	| "production"
	| "prototype"
	| "research"
	| "concept"
	| "demo"
	| "unspecified";

export interface PortfolioProblemMapping {
	id: string;
	label: string;
	score: number;
	reason: string;
}

export interface PortfolioKnowledgeProject {
	id: string;
	slug: string;
	title: string;
	url: string;
	description: string;
	category: string;
	year: string;
	tags: string[];
	technologies: string[];
	capabilities: string[];
	impactDomains: string[];
	problems: PortfolioProblemMapping[];
	searchableContent: string;
	actions: PortfolioAction[];
	architecture: {
		available: boolean;
		url: string;
		details: string;
	};
	deployment: {
		status: PortfolioDeploymentStatus;
		evidence: string[];
		details: string;
	};
	datasetDetails: string;
	resultsAndMetrics: string;
	relatedProjectIds: string[];
}

export interface PortfolioKnowledgeIndex {
	version: 1;
	projectCount: number;
	projects: PortfolioKnowledgeProject[];
	links: {
		allProjects: string;
		chooseProblem: string;
		impactDomain: string;
	};
}

type ExtendedPortfolioMetadata = {
	private?: boolean;
	admin?: boolean;
	unpublished?: boolean;
	featured?: boolean;
	technologies?: string[];
	github_url?: string;
	demo_url?: string;
	paper_url?: string;
	documentation_url?: string;
	deployment?: string;
	dataset?: string;
	results?: string;
	related_projects?: Array<
		string | { title: string; url: string; description?: string }
	>;
};

const MAX_SEARCHABLE_CONTENT_LENGTH = 8_000;
const MAX_DETAIL_LENGTH = 700;

function normalizeValue(value: string): string {
	return String(value || "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim()
		.toLowerCase();
}

function uniqueValues(values: string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];

	for (const rawValue of values) {
		const value = String(rawValue || "").trim();
		const key = normalizeValue(value);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		result.push(value);
	}

	return result;
}

function stripMarkdown(value: string): string {
	return value
		.replace(/^---[\s\S]*?---/m, " ")
		.replace(/```[^\n]*\n/g, " ")
		.replace(/```/g, " ")
		.replace(/:::[\w-]+(?:\{[^}]*\})?/g, " ")
		.replace(/::github\{[^}]*\}/g, " ")
		.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/<[^>]+>/g, " ")
		.replace(/^#{1,6}\s+/gm, " ")
		.replace(/[\t|>*_`~{}[\]]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function compact(value: string, maxLength = MAX_DETAIL_LENGTH): string {
	const normalized = stripMarkdown(value);
	if (normalized.length <= maxLength) return normalized;
	const truncated = normalized.slice(0, maxLength);
	const lastSpace = truncated.lastIndexOf(" ");
	return `${truncated.slice(0, Math.max(lastSpace, maxLength - 80)).trim()}…`;
}

function flattenStructuredValue(value: unknown): string[] {
	if (typeof value === "string") return [value];
	if (typeof value === "number" || typeof value === "boolean") {
		return [String(value)];
	}
	if (Array.isArray(value)) {
		return value.flatMap((item) => flattenStructuredValue(item));
	}
	if (value && typeof value === "object") {
		return Object.values(value).flatMap((item) => flattenStructuredValue(item));
	}
	return [];
}

function extractSection(body: string, headingPattern: RegExp): string {
	const lines = body.split(/\r?\n/);
	let collecting = false;
	const selected: string[] = [];

	for (const line of lines) {
		const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
		if (heading) {
			if (collecting) break;
			if (headingPattern.test(stripMarkdown(heading[2]))) {
				collecting = true;
			}
			continue;
		}
		if (collecting) selected.push(line);
	}

	return compact(selected.join("\n"));
}

function splitEvidenceText(body: string): string[] {
	return body
		.split(/(?<=[.!?])\s+|\r?\n+/)
		.map((part) => compact(part, 260))
		.filter((part) => part.length >= 12);
}

function extractEvidence(body: string, pattern: RegExp, limit = 2): string[] {
	return uniqueValues(
		splitEvidenceText(body).filter((sentence) => pattern.test(sentence)),
	).slice(0, limit);
}

const PRODUCTION_EVIDENCE_PATTERNS = [
	/\bdeployed\s+(?:to|on|in|at|across)\b/i,
	/\b(?:running|operating|used)\s+in\s+production\b/i,
	/\bproduction\s+deployment\b/i,
	/\blive\s+system\b/i,
	/\b24\s*(?:x|×)\s*7\b/i,
	/\brtsp\s+streams?\b/i,
	/\bclient\s+environment\b/i,
	/\b(?:local|cloud|edge)\s+deployment\b/i,
	/\boperational\s+dashboard\b/i,
];

const NON_DEPLOYMENT_CONTEXT =
	/\b(?:can|could|may|might|would|future|planned|planning|roadmap|target|intended|requires?|requiring|before|not|isn'?t|is not|path|pattern|ready|deployable|deployment-ready|oriented|focus|story|approval|concept|proposal|proposed)\b/i;

function getProductionEvidence(body: string): string[] {
	return uniqueValues(
		splitEvidenceText(body).filter((sentence) => {
			if (NON_DEPLOYMENT_CONTEXT.test(sentence)) return false;
			return PRODUCTION_EVIDENCE_PATTERNS.some((pattern) =>
				pattern.test(sentence),
			);
		}),
	).slice(0, 3);
}

function classifyDeployment(
	body: string,
	explicitDeployment: string,
	hasDemo: boolean,
): PortfolioKnowledgeProject["deployment"] {
	const source = `${explicitDeployment}\n${body}`;
	const explicitProduction =
		explicitDeployment &&
		!NON_DEPLOYMENT_CONTEXT.test(explicitDeployment) &&
		/\b(?:production|deployed|live system|client environment|operational dashboard)\b/i.test(
			explicitDeployment,
		);
	const productionEvidence = getProductionEvidence(source);
	const deploymentSection = extractSection(
		body,
		/\b(deployment|production|operations?|hosting|serving)\b/i,
	);
	const details = compact(explicitDeployment || deploymentSection || "");

	if (explicitProduction || productionEvidence.length > 0) {
		const evidence = explicitProduction
			? uniqueValues([compact(explicitDeployment, 260), ...productionEvidence])
			: productionEvidence;
		return {
			status: "production",
			evidence,
			details: details || evidence.join(" "),
		};
	}

	const plainSource = stripMarkdown(source);
	if (/\b(prototype|proof[- ]of[- ]concept|\bpoc\b)\b/i.test(plainSource)) {
		return {
			status: "prototype",
			evidence: extractEvidence(
				source,
				/\b(prototype|proof[- ]of[- ]concept|\bpoc\b)\b/i,
			),
			details,
		};
	}
	if (
		/\b(research experiment|experiment|benchmark|research project|research study)\b/i.test(
			plainSource,
		)
	) {
		return {
			status: "research",
			evidence: extractEvidence(
				source,
				/\b(research experiment|experiment|benchmark|research project|research study)\b/i,
			),
			details,
		};
	}
	if (/\b(concept|conceptual|planned system)\b/i.test(plainSource)) {
		return {
			status: "concept",
			evidence: extractEvidence(
				source,
				/\b(concept|conceptual|planned system)\b/i,
			),
			details,
		};
	}
	if (hasDemo) {
		return {
			status: "demo",
			evidence: [],
			details,
		};
	}

	return {
		status: "unspecified",
		evidence: [],
		details,
	};
}

function isPublishedPortfolioEntry(entry: CollectionEntry<"posts">): boolean {
	const metadata = entry.data as CollectionEntry<"posts">["data"] &
		ExtendedPortfolioMetadata;
	return (
		entry.data.draft !== true &&
		metadata.private !== true &&
		metadata.admin !== true &&
		metadata.unpublished !== true &&
		entry.data.published.getTime() <= Date.now()
	);
}

function mergeActions(
	extracted: PortfolioAction[],
	metadata: ExtendedPortfolioMetadata,
): PortfolioAction[] {
	const explicit: PortfolioAction[] = [
		metadata.github_url
			? { kind: "github", label: "GitHub", url: metadata.github_url }
			: null,
		metadata.demo_url
			? { kind: "demo", label: "Live Demo", url: metadata.demo_url }
			: null,
		metadata.paper_url
			? { kind: "paper", label: "Paper", url: metadata.paper_url }
			: null,
		metadata.documentation_url
			? {
					kind: "docs",
					label: "Documentation",
					url: metadata.documentation_url,
				}
			: null,
	].filter((action): action is PortfolioAction => Boolean(action));

	const byKind = new Map<PortfolioActionKind, PortfolioAction>();
	for (const action of [...explicit, ...extracted]) {
		if (!action.url || byKind.has(action.kind)) continue;
		byKind.set(action.kind, action);
	}
	return [...byKind.values()];
}

function isVideoUrl(value: string): boolean {
	return /(?:youtube\.com\/watch|youtu\.be\/|vimeo\.com\/)/i.test(value);
}

function getStructuredDeploymentDetails(
	entry: CollectionEntry<"posts">,
): string {
	return uniqueValues([
		entry.data.deployment || "",
		entry.data.comparison?.deployment_status || "",
		entry.data.comparison?.deployment_environment || "",
		...flattenStructuredValue(entry.data.views?.executive?.deployment_context),
		...flattenStructuredValue(
			entry.data.views?.technical?.deployment_architecture,
		),
		...flattenStructuredValue(entry.data.views?.technical?.infrastructure),
	]).join(". ");
}

function getStructuredDatasetDetails(entry: CollectionEntry<"posts">): string {
	return uniqueValues([
		entry.data.dataset || "",
		entry.data.comparison?.dataset || "",
		...flattenStructuredValue(entry.data.views?.technical?.dataset),
	]).join(". ");
}

function getStructuredResults(entry: CollectionEntry<"posts">): string {
	return uniqueValues([
		entry.data.results || "",
		entry.data.comparison?.evaluation_metrics || "",
		...flattenStructuredValue(entry.data.views?.technical?.metrics),
		...flattenStructuredValue(entry.data.views?.technical?.training_evaluation),
		...flattenStructuredValue(entry.data.views?.executive?.outcome),
	]).join(". ");
}

function getStructuredTechnologies(entry: CollectionEntry<"posts">): string[] {
	const algorithmNames = (entry.data.views?.technical?.algorithms || []).map(
		(algorithm) => (typeof algorithm === "string" ? algorithm : algorithm.name),
	);
	return uniqueValues([
		...(entry.data.technologies || []),
		...(entry.data.comparison?.technologies || []),
		...algorithmNames,
	]);
}

function mergeProblemMappings(
	project: ReturnType<
		typeof buildProjectProblemExplorerData
	>["projects"][number],
	problemsById: Map<
		string,
		ReturnType<typeof buildProjectProblemExplorerData>["problems"][number]
	>,
	explicitProblems: string[],
): PortfolioProblemMapping[] {
	const byId = new Map<string, PortfolioProblemMapping>();
	for (const problem of explicitProblems) {
		const id = toFilterKey(problem);
		if (!id) continue;
		byId.set(id, {
			id,
			label: problem,
			score: 100,
			reason: "Explicit portfolio problem mapping.",
		});
	}
	for (const match of project.matches) {
		if (byId.has(match.problemId)) continue;
		byId.set(match.problemId, {
			id: match.problemId,
			label: problemsById.get(match.problemId)?.label || match.problemId,
			score: match.score,
			reason: match.matchReason,
		});
	}
	return [...byId.values()];
}
function headingAnchor(body: string, pattern: RegExp): string {
	for (const line of body.split(/\r?\n/)) {
		const match = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
		if (!match || !pattern.test(match[1])) continue;
		return normalizeValue(stripMarkdown(match[1]))
			.replace(/[^a-z0-9\s-]/g, "")
			.replace(/\s+/g, "-")
			.replace(/-+/g, "-");
	}
	return "";
}

function getResultsAndMetrics(body: string, explicitResults: string): string {
	if (explicitResults) return compact(explicitResults);
	const section = extractSection(
		body,
		/\b(results?|metrics?|evaluation|performance|outcomes?)\b/i,
	);
	if (section) return section;
	return extractEvidence(
		body,
		/\b(accuracy|precision|recall|f1(?:[- ]score)?|latency|throughput|improvement|reduction|benchmark result)\b/i,
		3,
	).join(" ");
}

function getDatasetDetails(body: string, explicitDataset: string): string {
	if (explicitDataset) return compact(explicitDataset);
	const section = extractSection(
		body,
		/\b(dataset|data source|training data|evaluation data)\b/i,
	);
	if (section) return section;
	return extractEvidence(
		body,
		/\b(dataset|training data|evaluation data|synthetic data)\b/i,
		2,
	).join(" ");
}

export function buildPortfolioKnowledgeIndex(
	entries: CollectionEntry<"posts">[],
): PortfolioKnowledgeIndex {
	const publishedEntries = entries.filter(isPublishedPortfolioEntry);
	const problemData = buildProjectProblemExplorerData(publishedEntries);
	const impactData = buildProjectImpactGraphData(publishedEntries);
	const sourceById = new Map(
		publishedEntries.map((entry) => [toFilterKey(entry.slug), entry]),
	);
	const problemsById = new Map(
		problemData.problems.map((problem) => [problem.id, problem]),
	);
	const impactById = new Map(
		impactData.projects.map((project) => [project.id, project]),
	);

	const projects: PortfolioKnowledgeProject[] = problemData.projects
		.map((project) => {
			const entry = sourceById.get(project.id);
			if (!entry) return null;
			const metadata = entry.data as CollectionEntry<"posts">["data"] &
				ExtendedPortfolioMetadata;
			const impact = impactById.get(project.id);
			const body = entry.body || "";
			const explicitTechnologies = getStructuredTechnologies(entry);
			const technologies = uniqueValues([
				...explicitTechnologies,
				...project.technologyTags,
			]);
			const extractedActions = project.actions.map((action) => ({
				kind:
					action.kind === "video" ||
					(action.kind === "demo" && isVideoUrl(action.url))
						? ("video" as const)
						: action.kind,
				label: action.label,
				url: action.url,
			}));
			const actions = mergeActions(extractedActions, metadata);
			const architectureHeading = headingAnchor(body, /architecture/i);
			const architectureAvailable =
				project.architecturePreview.status !== "missing";
			const architectureDetails = compact(
				[
					entry.data.architecture?.alt || "",
					entry.data.architecture?.caption || "",
					extractSection(body, /\b(architecture|system design)\b/i),
				].join(". "),
			);
			const explicitRelatedIds = (metadata.related_projects || [])
				.filter((related): related is string => typeof related === "string")
				.map(toFilterKey);
			const structuredDeployment = getStructuredDeploymentDetails(entry);
			const deployment = classifyDeployment(
				body,
				structuredDeployment,
				actions.some((action) => action.kind === "demo"),
			);

			const structuredSearchContent = uniqueValues([
				...flattenStructuredValue(entry.data.views),
				...flattenStructuredValue(entry.data.comparison),
				...flattenStructuredValue(entry.data.contribution),
				...flattenStructuredValue(entry.data.project_links),
			]).join(" ");
			const impactDomains = uniqueValues([
				...(impact?.domains || []),
				entry.data.impact_domain || "",
				...(entry.data.impact_domains || []),
			]);
			return {
				id: project.id,
				slug: entry.slug,
				title: project.title,
				url: project.url,
				description: project.description,
				category: project.category,
				year: project.year,
				tags: project.tags,
				technologies,
				capabilities: uniqueValues(entry.data.capabilities || []),
				impactDomains,
				problems: mergeProblemMappings(
					project,
					problemsById,
					entry.data.problems || [],
				),
				searchableContent: compact(
					`${body}\n${structuredSearchContent}`,
					MAX_SEARCHABLE_CONTENT_LENGTH,
				),
				actions,
				architecture: {
					available: architectureAvailable,
					url: architectureAvailable
						? `${project.url}${architectureHeading ? `#${architectureHeading}` : ""}`
						: "",
					details: architectureDetails,
				},
				deployment,
				datasetDetails: getDatasetDetails(
					body,
					getStructuredDatasetDetails(entry),
				),
				resultsAndMetrics: getResultsAndMetrics(
					body,
					getStructuredResults(entry),
				),
				relatedProjectIds: uniqueValues([
					...(impact?.relatedProjects || []),
					...explicitRelatedIds,
				]),
			} satisfies PortfolioKnowledgeProject;
		})
		.filter(
			(project): project is PortfolioKnowledgeProject => project !== null,
		);

	return {
		version: 1,
		projectCount: projects.length,
		projects,
		links: {
			allProjects: url("/"),
			chooseProblem: url("/?view=problems"),
			impactDomain: url("/impact-domain/"),
		},
	};
}
