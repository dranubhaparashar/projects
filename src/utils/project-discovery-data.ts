import type { CollectionEntry } from "astro:content";
import {
	type ProjectIndustry,
	projectIndustries,
} from "../config/project-industries";
import { getPostPdfPath } from "./pdf-utils";
import { buildProjectCapabilityMatrixData } from "./project-capability-matching";
import {
	buildProjectCardData,
	type ProjectCardData,
} from "./project-card-data";
import { buildProjectImpactGraphData } from "./project-impact-data";
import { buildPortfolioKnowledgeIndex } from "./project-intelligence-index";
import {
	buildProjectProblemExplorerData,
	toFilterKey,
} from "./project-problem-matching";
import { getPostUrlBySlug, url } from "./url-utils";

export interface ProjectDiscoveryRelatedProject {
	id: string;
	title: string;
	url: string;
}

export interface ProjectDiscoveryRecord {
	id: string;
	slug: string;
	title: string;
	url: string;
	description: string;
	category: string;
	publishedMs: number;
	featured: boolean;
	industryIds: string[];
	industryLabels: string[];
	primaryIndustry?: { id: string; label: string };
	capabilityIds: string[];
	capabilityLabels: string[];
	technologies: Array<{ id: string; label: string }>;
	problemIds: string[];
	impactDomains: string[];
	status: string;
	searchText: string;
	relatedProjects: ProjectDiscoveryRelatedProject[];
	card: ProjectCardData;
}

export type ProjectSuggestionKind =
	| "project"
	| "technology"
	| "capability"
	| "industry"
	| "problem";

export interface ProjectSearchSuggestion {
	id: string;
	kind: ProjectSuggestionKind;
	label: string;
	secondary?: string;
	url?: string;
	value?: string;
	projectIds: string[];
}

export interface ProjectDiscoveryData {
	records: ProjectDiscoveryRecord[];
	industries: Array<{ id: string; label: string; count: number }>;
	quickCapabilities: Array<{ id: string; label: string; count: number }>;
	technologies: Array<{ id: string; label: string; count: number }>;
	categories: string[];
	statuses: Array<{ id: string; label: string }>;
	suggestions: ProjectSearchSuggestion[];
}

const QUICK_CAPABILITY_IDS = [
	"computer-vision",
	"generative-ai",
	"agentic-ai",
	"mlops",
	"optimization",
	"security",
	"predictive-analytics",
	"document-intelligence",
] as const;

const STATUS_DISPLAY_LABELS: Record<string, string> = {
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

function unique<T>(values: T[], key: (value: T) => string): T[] {
	const seen = new Set<string>();
	return values.filter((value) => {
		const id = key(value);
		if (!id || seen.has(id)) return false;
		seen.add(id);
		return true;
	});
}

function containsTerm(text: string, term: string): boolean {
	const haystack = ` ${normalize(text).replace(/[^a-z0-9]+/g, " ")} `;
	const needle = ` ${normalize(term).replace(/[^a-z0-9]+/g, " ")} `;
	return needle.trim().length >= 4 && haystack.includes(needle);
}

function explicitIndustryMatch(
	value: string,
	industry: ProjectIndustry,
): boolean {
	const key = toFilterKey(value);
	return [
		industry.id,
		industry.label,
		...(industry.aliases || []),
		...industry.tags,
	].some((candidate) => toFilterKey(candidate) === key);
}

function industriesFromTerms(
	values: string[],
	selector: (industry: ProjectIndustry) => string[],
	exact: boolean,
): ProjectIndustry[] {
	return projectIndustries.filter((industry) =>
		values.some((value) =>
			selector(industry).some((term) =>
				exact
					? normalize(value) === normalize(term)
					: containsTerm(value, term),
			),
		),
	);
}

/**
 * Industry inference is intentionally tiered. The first tier with a confident
 * match wins, preventing weak description language from overriding explicit or
 * tag-based evidence.
 */
function inferIndustries(
	entry: CollectionEntry<"posts">,
	problemIds: string[],
	impactDomains: string[],
): ProjectIndustry[] {
	const explicit = [
		...(Array.isArray(entry.data.industry)
			? entry.data.industry
			: [entry.data.industry || ""]),
		entry.data.comparison?.industry || "",
	].filter(Boolean);
	const explicitMatches = unique(
		explicit.flatMap((value) =>
			projectIndustries.filter((industry) =>
				explicitIndustryMatch(value, industry),
			),
		),
		(industry) => industry.id,
	);
	if (explicitMatches.length) return explicitMatches;

	const tagMatches = industriesFromTerms(
		entry.data.tags || [],
		(industry) => industry.tags,
		true,
	);
	if (tagMatches.length) return tagMatches;

	const problemMatches = projectIndustries.filter((industry) =>
		(industry.relatedProblems || []).some((problem) =>
			problemIds.includes(toFilterKey(problem)),
		),
	);
	if (problemMatches.length) return problemMatches;

	const domainMatches = projectIndustries.filter((industry) =>
		(industry.relatedImpactDomains || []).some((domain) =>
			impactDomains.some((value) => normalize(value) === normalize(domain)),
		),
	);
	if (domainMatches.length) return domainMatches;

	const titleMatches = industriesFromTerms(
		[entry.data.title],
		(industry) => industry.keywords,
		false,
	);
	if (titleMatches.length) return titleMatches;

	return industriesFromTerms(
		[entry.data.description || ""],
		(industry) => industry.keywords,
		false,
	);
}

function intersectionCount(left: string[], right: string[]): number {
	const rightSet = new Set(right.map(normalize));
	return left.filter((value) => rightSet.has(normalize(value))).length;
}

function compareRelated(
	left: {
		sharedDomain: number;
		sharedCapabilities: number;
		sharedTechnologies: number;
		sharedIndustry: number;
		sharedProblems: number;
		impactEdge: number;
		title: string;
	},
	right: typeof left,
): number {
	for (const key of [
		"sharedDomain",
		"sharedCapabilities",
		"sharedTechnologies",
		"sharedIndustry",
		"sharedProblems",
		"impactEdge",
	] as const) {
		if (left[key] !== right[key]) return right[key] - left[key];
	}
	return left.title.localeCompare(right.title);
}

function buildSuggestions(
	records: ProjectDiscoveryRecord[],
	capabilityLabels: Map<string, string>,
	problemLabels: Map<string, string>,
): ProjectSearchSuggestion[] {
	const suggestions: ProjectSearchSuggestion[] = records.map((record) => ({
		id: `project:${record.id}`,
		kind: "project",
		label: record.title,
		secondary: record.primaryIndustry?.label || record.category,
		url: record.url,
		projectIds: [record.id],
	}));
	const aggregate = (
		kind: Exclude<ProjectSuggestionKind, "project">,
		values: Array<{ id: string; label: string; projectId: string }>,
	) => {
		const byId = new Map<string, ProjectSearchSuggestion>();
		for (const value of values) {
			const current = byId.get(value.id) || {
				id: `${kind}:${value.id}`,
				kind,
				label: value.label,
				value: value.id,
				projectIds: [],
			};
			if (!current.projectIds.includes(value.projectId)) {
				current.projectIds.push(value.projectId);
			}
			byId.set(value.id, current);
		}
		suggestions.push(...byId.values());
	};

	aggregate(
		"technology",
		records.flatMap((record) =>
			record.technologies.map((technology) => ({
				...technology,
				projectId: record.id,
			})),
		),
	);
	aggregate(
		"capability",
		records.flatMap((record) =>
			record.capabilityIds.map((id) => ({
				id,
				label: capabilityLabels.get(id) || id,
				projectId: record.id,
			})),
		),
	);
	aggregate(
		"industry",
		records.flatMap((record) =>
			record.industryIds.map((id, index) => ({
				id,
				label: record.industryLabels[index] || id,
				projectId: record.id,
			})),
		),
	);
	aggregate(
		"problem",
		records.flatMap((record) =>
			record.problemIds.map((id) => ({
				id,
				label: problemLabels.get(id) || id,
				projectId: record.id,
			})),
		),
	);
	return suggestions;
}

export function buildProjectDiscoveryData(
	entries: CollectionEntry<"posts">[],
): ProjectDiscoveryData {
	const now = Date.now();
	const published = entries.filter(
		(entry) =>
			entry.data.draft !== true && entry.data.published.getTime() <= now,
	);
	const problems = buildProjectProblemExplorerData(published);
	const impact = buildProjectImpactGraphData(published);
	const knowledge = buildPortfolioKnowledgeIndex(published);
	const capabilities = buildProjectCapabilityMatrixData(published, knowledge);
	const problemProjectById = new Map(
		problems.projects.map((project) => [project.id, project]),
	);
	const impactById = new Map(
		impact.projects.map((project) => [project.id, project]),
	);
	const capabilityProjectById = new Map(
		capabilities.projects.map((project) => [project.id, project]),
	);
	const capabilityLabels = new Map(
		capabilities.capabilities.map((capability) => [
			capability.id,
			capability.label,
		]),
	);
	const problemLabels = new Map(
		problems.problems.map((problem) => [problem.id, problem.label]),
	);

	const records: ProjectDiscoveryRecord[] = published.map((entry) => {
		const id = toFilterKey(entry.slug);
		const projectUrl = getPostUrlBySlug(entry.slug);
		const rawPdf = getPostPdfPath(entry);
		const pdfUrl = /^https?:\/\//i.test(rawPdf) ? rawPdf : url(rawPdf);
		const problemProject = problemProjectById.get(id);
		const impactProject = impactById.get(id);
		const capabilityProject = capabilityProjectById.get(id);
		const problemIds =
			problemProject?.matches.map((match) => match.problemId) || [];
		const impactDomains = impactProject?.domains || [];
		const industries = inferIndustries(entry, problemIds, impactDomains);
		const technologyLabels = unique(
			[
				...(capabilityProject?.technologies || []),
				...(problemProject?.technologyTags || []),
			],
			(value) => toFilterKey(value),
		);
		const capabilityIds = capabilityProject?.capabilityIds || [];
		const capabilityLabelsForProject = capabilityIds.map(
			(capabilityId) => capabilityLabels.get(capabilityId) || capabilityId,
		);
		const category = entry.data.category?.trim() || "Uncategorized";
		const searchText = [
			entry.data.title,
			entry.data.description,
			category,
			...(entry.data.tags || []),
			...technologyLabels,
			...capabilityLabelsForProject,
			...industries.map((industry) => industry.label),
			...problemIds.map(
				(problemId) => problemLabels.get(problemId) || problemId,
			),
		].join(" ");
		const card = buildProjectCardData(entry, projectUrl, pdfUrl);
		return {
			id,
			slug: entry.slug,
			title: entry.data.title,
			url: projectUrl,
			description: entry.data.description || "",
			category,
			publishedMs: entry.data.published.getTime(),
			featured: entry.data.featured === true,
			industryIds: industries.map((industry) => industry.id),
			industryLabels: industries.map((industry) => industry.label),
			primaryIndustry: industries[0]
				? { id: industries[0].id, label: industries[0].label }
				: undefined,
			capabilityIds,
			capabilityLabels: capabilityLabelsForProject,
			technologies: technologyLabels.map((label) => ({
				id: toFilterKey(label),
				label,
			})),
			problemIds,
			impactDomains,
			status: card.status?.type || "",
			searchText: normalize(searchText),
			relatedProjects: [],
			card,
		};
	});

	for (const record of records) {
		const impactProject = impactById.get(record.id);
		record.relatedProjects = records
			.filter((candidate) => candidate.id !== record.id)
			.map((candidate) => ({
				candidate,
				sharedDomain: intersectionCount(
					record.impactDomains,
					candidate.impactDomains,
				),
				sharedCapabilities: intersectionCount(
					record.capabilityIds,
					candidate.capabilityIds,
				),
				sharedTechnologies: intersectionCount(
					record.technologies.map((item) => item.id),
					candidate.technologies.map((item) => item.id),
				),
				sharedIndustry: intersectionCount(
					record.industryIds,
					candidate.industryIds,
				),
				sharedProblems: intersectionCount(
					record.problemIds,
					candidate.problemIds,
				),
				impactEdge: impactProject?.relatedProjects.includes(candidate.id)
					? 1
					: 0,
				title: candidate.title,
			}))
			.filter(
				(item) =>
					item.impactEdge > 0 ||
					item.sharedDomain > 0 ||
					item.sharedCapabilities > 0 ||
					item.sharedTechnologies > 0 ||
					item.sharedIndustry > 0 ||
					item.sharedProblems > 0,
			)
			.sort(compareRelated)
			.slice(0, 2)
			.map(({ candidate }) => ({
				id: candidate.id,
				title: candidate.card.displayTitle,
				url: candidate.url,
			}));
	}

	const industries = projectIndustries.map((industry) => ({
		id: industry.id,
		label: industry.label,
		count: records.filter((record) => record.industryIds.includes(industry.id))
			.length,
	}));
	const quickCapabilities = QUICK_CAPABILITY_IDS.map((id) => ({
		id,
		label: capabilityLabels.get(id) || id,
		count: records.filter((record) => record.capabilityIds.includes(id)).length,
	})).filter((capability) => capability.count > 0);
	const technologyCounts = new Map<string, { label: string; count: number }>();
	for (const record of records) {
		for (const technology of record.technologies) {
			const current = technologyCounts.get(technology.id) || {
				label: technology.label,
				count: 0,
			};
			current.count += 1;
			technologyCounts.set(technology.id, current);
		}
	}
	const technologies = [...technologyCounts.entries()]
		.map(([id, value]) => ({ id, ...value }))
		.sort(
			(left, right) =>
				right.count - left.count || left.label.localeCompare(right.label),
		);
	const statuses = unique(
		records
			.filter((record) => record.status)
			.map((record) => ({
				id: record.status,
				label:
					STATUS_DISPLAY_LABELS[record.status] ||
					record.status.charAt(0).toUpperCase() + record.status.slice(1),
			})),
		(value) => value.id,
	);

	return {
		records,
		industries,
		quickCapabilities,
		technologies,
		categories: unique(
			records.map((record) => record.category),
			normalize,
		).sort(),
		statuses,
		suggestions: buildSuggestions(records, capabilityLabels, problemLabels),
	};
}
