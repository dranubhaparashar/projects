import type { CollectionEntry } from "astro:content";
import {
	type ProjectCapabilityDefinition,
	projectCapabilities,
} from "../config/project-capabilities";
import type {
	PortfolioAction,
	PortfolioKnowledgeIndex,
	PortfolioKnowledgeProject,
} from "./project-intelligence-index";
import { toFilterKey } from "./project-problem-matching";

type CapabilityMetadata = CollectionEntry<"posts">["data"] & {
	capabilities?: string[];
	technologies?: string[];
};

export interface ProjectCapabilityMatch {
	capabilityId: string;
	projectId: string;
	explanation: string;
	evidence: string[];
	excerpt: string;
	deploymentContext: string;
	technologies: string[];
	actions: PortfolioAction[];
}

export interface CapabilityMatrixCapability
	extends Pick<ProjectCapabilityDefinition, "id" | "label" | "description"> {
	matchCount: number;
}

export interface CapabilityMatrixProject {
	id: string;
	title: string;
	shortTitle: string;
	url: string;
	description: string;
	category: string;
	impactDomains: string[];
	tags: string[];
	technologies: string[];
	actions: PortfolioAction[];
	capabilityIds: string[];
}

export interface ProjectCapabilityMatrixData {
	capabilities: CapabilityMatrixCapability[];
	projects: CapabilityMatrixProject[];
	matches: Record<string, Record<string, ProjectCapabilityMatch>>;
	filters: {
		impactDomains: string[];
		categories: string[];
	};
}

const GENERIC_BODY_TERMS = new Set([
	"ai",
	"analytics",
	"automation",
	"cloud",
	"deployment",
	"security",
	"workflow",
]);

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
		.replace(/```[\s\S]*?```/g, " ")
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

function compact(value: string, maxLength = 340): string {
	const normalized = stripMarkdown(value);
	if (normalized.length <= maxLength) return normalized;
	const truncated = normalized.slice(0, maxLength);
	const lastSpace = truncated.lastIndexOf(" ");
	return `${truncated.slice(0, Math.max(lastSpace, maxLength - 60)).trim()}…`;
}

function includesTerm(source: string, term: string): boolean {
	const normalizedTerm = normalizeValue(term);
	if (!normalizedTerm) return false;
	return normalizeValue(source).includes(normalizedTerm);
}

function exactMatches(values: string[], candidates: string[] = []): string[] {
	const candidateByKey = new Map(
		candidates.map((candidate) => [normalizeValue(candidate), candidate]),
	);
	return uniqueValues(
		values
			.map((value) => candidateByKey.get(normalizeValue(value)) || "")
			.filter(Boolean),
	);
}

function matchingTerms(source: string, terms: string[]): string[] {
	return uniqueValues(terms.filter((term) => includesTerm(source, term)));
}

function getRelevantExcerpt(
	description: string,
	body: string,
	terms: string[],
): string {
	const sources = [description, ...body.split(/\r?\n+/)];
	for (const source of sources) {
		const plain = stripMarkdown(source);
		if (plain.length >= 24 && terms.some((term) => includesTerm(plain, term))) {
			return compact(plain);
		}
	}
	return "";
}

function getShortTitle(title: string): string {
	const withoutSubtitle = title.split(/[:|—–]/)[0]?.trim() || title;
	if (withoutSubtitle.length <= 42) return withoutSubtitle;
	return `${withoutSubtitle.slice(0, 39).trim()}…`;
}

function getBodyEvidenceTerms(
	body: string,
	definition: ProjectCapabilityDefinition,
): string[] {
	const exactTags = matchingTerms(body, definition.tags).filter((term) => {
		const normalized = normalizeValue(term);
		return normalized.length >= 4 && !GENERIC_BODY_TERMS.has(normalized);
	});
	const keywords = matchingTerms(body, definition.keywords).filter((term) => {
		const normalized = normalizeValue(term);
		return (
			normalized.includes(" ") ||
			(normalized.length >= 8 && !GENERIC_BODY_TERMS.has(normalized))
		);
	});
	return uniqueValues([...exactTags, ...keywords]);
}

function createMatch(
	entry: CollectionEntry<"posts">,
	project: PortfolioKnowledgeProject,
	definition: ProjectCapabilityDefinition,
): ProjectCapabilityMatch | null {
	const metadata = entry.data as CapabilityMetadata;
	const body = entry.body || "";
	const explicitIds = uniqueValues(metadata.capabilities || []).map(
		normalizeValue,
	);
	const exactTagMatches = exactMatches(project.tags, definition.tags);
	const exactTechnologyMatches = exactMatches(
		project.technologies,
		definition.tags,
	);
	const domainMatches = exactMatches(
		project.impactDomains,
		definition.impactDomains,
	);
	const problemIds = project.problems.map((problem) => problem.id);
	const problemMatches = exactMatches(problemIds, definition.problemMappings);
	const categoryMatches = exactMatches(
		[project.category],
		definition.categories,
	);
	const titleTerms = matchingTerms(project.title, [
		...definition.tags,
		...definition.keywords,
	]);
	const descriptionTerms = matchingTerms(project.description, [
		...definition.tags,
		...definition.keywords,
	]);
	const bodyTerms = getBodyEvidenceTerms(body, definition);
	const isExplicit = explicitIds.includes(normalizeValue(definition.id));

	const hasGroundedMatch =
		isExplicit ||
		exactTagMatches.length > 0 ||
		exactTechnologyMatches.length > 0 ||
		domainMatches.length > 0 ||
		problemMatches.length > 0 ||
		categoryMatches.length > 0 ||
		titleTerms.length > 0 ||
		descriptionTerms.length > 0 ||
		bodyTerms.length > 0;

	if (!hasGroundedMatch) return null;

	const evidence = uniqueValues([
		...(isExplicit ? [`Explicit capability: ${definition.label}`] : []),
		...exactTagMatches.map((value) => `Tag: ${value}`),
		...exactTechnologyMatches.map((value) => `Technology: ${value}`),
		...domainMatches.map((value) => `Impact domain: ${value}`),
		...problemMatches.map((value) => {
			const problem = project.problems.find(
				(item) => normalizeValue(item.id) === normalizeValue(value),
			);
			return `Problem mapping: ${problem?.label || value}`;
		}),
		...categoryMatches.map((value) => `Project type: ${value}`),
		...titleTerms.map((value) => `Project title: ${value}`),
		...descriptionTerms.map((value) => `Description: ${value}`),
		...bodyTerms.map((value) => `Project content: ${value}`),
	]).slice(0, 10);

	const excerptTerms = uniqueValues([
		...exactTagMatches,
		...exactTechnologyMatches,
		...titleTerms,
		...descriptionTerms,
		...bodyTerms,
		definition.label,
	]);
	const excerpt = getRelevantExcerpt(project.description, body, excerptTerms);
	const explanation =
		excerpt ||
		`${project.title} documents ${evidence
			.slice(0, 3)
			.map((item) => item.replace(/^[^:]+:\s*/, ""))
			.join(", ")} as evidence for ${definition.label}.`;
	const deploymentContext = compact(
		project.deployment.details || project.deployment.evidence.join(" "),
		280,
	);

	return {
		capabilityId: definition.id,
		projectId: project.id,
		explanation,
		evidence,
		excerpt: excerpt && excerpt !== explanation ? excerpt : "",
		deploymentContext,
		technologies: project.technologies,
		actions: project.actions,
	};
}

export function buildProjectCapabilityMatrixData(
	entries: CollectionEntry<"posts">[],
	knowledgeIndex: PortfolioKnowledgeIndex,
): ProjectCapabilityMatrixData {
	const entryById = new Map(
		entries
			.filter((entry) => entry.data.draft !== true)
			.map((entry) => [toFilterKey(entry.slug), entry]),
	);
	const matches: ProjectCapabilityMatrixData["matches"] = {};
	const projects: CapabilityMatrixProject[] = [];

	for (const project of knowledgeIndex.projects) {
		const entry = entryById.get(project.id);
		if (!entry) continue;
		const projectMatches: Record<string, ProjectCapabilityMatch> = {};

		for (const definition of projectCapabilities) {
			const match = createMatch(entry, project, definition);
			if (!match) continue;
			projectMatches[definition.id] = match;
		}

		matches[project.id] = projectMatches;
		projects.push({
			id: project.id,
			title: project.title,
			shortTitle: getShortTitle(project.title),
			url: project.url,
			description: project.description,
			category: project.category,
			impactDomains: project.impactDomains,
			tags: project.tags,
			technologies: project.technologies,
			actions: project.actions,
			capabilityIds: Object.keys(projectMatches),
		});
	}

	const capabilities = projectCapabilities.map((definition) => ({
		id: definition.id,
		label: definition.label,
		description: definition.description,
		matchCount: projects.filter((project) =>
			project.capabilityIds.includes(definition.id),
		).length,
	}));

	return {
		capabilities,
		projects,
		matches,
		filters: {
			impactDomains: uniqueValues(
				projects.flatMap((project) => project.impactDomains),
			).sort((a, b) => a.localeCompare(b)),
			categories: uniqueValues(
				projects.map((project) => project.category),
			).sort((a, b) => a.localeCompare(b)),
		},
	};
}
